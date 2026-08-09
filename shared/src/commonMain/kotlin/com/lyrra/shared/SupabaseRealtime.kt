package com.lyrra.shared

import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import io.ktor.websocket.send
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Low-level Supabase Realtime WebSocket client.
 * Handles channel join, broadcast send/receive, and presence tracking using Ktor WebSockets.
 */
class SupabaseRealtime(
    private val supabaseUrl: String,
    private val supabaseKey: String,
) {
    companion object {
        private const val TAG = "SupabaseRealtime"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        private val jsonParser = Json { ignoreUnknownKeys = true }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val client = HttpClient {
        install(WebSockets)
    }

    private var session: DefaultClientWebSocketSession? = null
    private var refCounter = 0
    private var channelTopic: String? = null
    private var heartbeatJob: kotlinx.coroutines.Job? = null
    private var listenJob: kotlinx.coroutines.Job? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _presenceMembers = MutableStateFlow<List<String>>(emptyList())
    val presenceMembers: StateFlow<List<String>> = _presenceMembers.asStateFlow()

    val incomingMessages = Channel<JsonObject>(Channel.BUFFERED)

    fun connectAndJoin(roomCode: String, displayName: String) {
        val topic = "realtime:$roomCode"
        channelTopic = topic
        val wsUrl = supabaseUrl.replace("https://", "wss://").replace("http://", "ws://") +
                "/realtime/v1/websocket?apikey=$supabaseKey&v=2.0.0"

        scope.launch {
            try {
                session = client.webSocketSession(wsUrl)
                println("[$TAG] WebSocket connected")
                _isConnected.value = true
                joinChannel(displayName)
                startHeartbeat()

                listenJob = scope.launch {
                    val s = session ?: return@launch
                    for (frame in s.incoming) {
                        if (frame is Frame.Text) {
                            handleMessage(frame.readText())
                        }
                    }
                }
            } catch (e: Exception) {
                println("[$TAG] WebSocket error: ${e.message}")
                _isConnected.value = false
            }
        }
    }

    private fun joinChannel(displayName: String) {
        val topic = channelTopic ?: return
        val joinMsg = buildJsonObject {
            put("topic", topic)
            put("event", "phx_join")
            put("payload", buildJsonObject {
                put("config", buildJsonObject {
                    put("broadcast", buildJsonObject { put("ack", false); put("self", false) })
                    put("presence", buildJsonObject { put("key", displayName) })
                })
            })
            put("ref", nextRef())
        }
        sendText(joinMsg.toString())

        val trackMsg = buildJsonObject {
            put("topic", topic)
            put("event", "presence")
            put("payload", buildJsonObject {
                put("event", "track")
                put("payload", buildJsonObject {
                    put("user", displayName)
                })
            })
            put("ref", nextRef())
        }
        sendText(trackMsg.toString())
    }

    fun broadcast(event: String, payload: JsonObject) {
        val topic = channelTopic ?: return
        val msg = buildJsonObject {
            put("topic", topic)
            put("event", "broadcast")
            put("payload", buildJsonObject {
                put("event", event)
                put("payload", payload)
            })
            put("ref", nextRef())
        }
        sendText(msg.toString())
    }

    fun disconnect() {
        heartbeatJob?.cancel()
        listenJob?.cancel()
        scope.launch {
            try {
                session?.close()
            } catch (_: Exception) {}
            session = null
            _isConnected.value = false
            _presenceMembers.value = emptyList()
        }
    }

    private fun sendText(text: String) {
        scope.launch {
            try {
                session?.send(Frame.Text(text))
            } catch (e: Exception) {
                println("[$TAG] Send error: ${e.message}")
            }
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (_isConnected.value) {
                kotlinx.coroutines.delay(HEARTBEAT_INTERVAL_MS)
                val msg = buildJsonObject {
                    put("topic", "phoenix")
                    put("event", "heartbeat")
                    put("payload", buildJsonObject {})
                    put("ref", nextRef())
                }
                sendText(msg.toString())
            }
        }
    }

    private fun handleMessage(text: String) {
        try {
            val json = jsonParser.parseToJsonElement(text).jsonObject
            val event = json["event"]?.jsonPrimitive?.content ?: ""
            val payload = json["payload"]?.jsonObject ?: return

            when (event) {
                "broadcast" -> {
                    val broadcastEvent = payload["event"]?.jsonPrimitive?.content ?: ""
                    val innerPayload = payload["payload"]?.jsonObject ?: payload
                    scope.launch {
                        val out = buildJsonObject {
                            put("event", broadcastEvent)
                            put("payload", innerPayload)
                        }
                        incomingMessages.send(out)
                    }
                }
                "presence_state" -> {
                    val members = payload.keys.toList()
                    _presenceMembers.value = members
                }
                "presence_diff" -> {
                    val joins = payload["joins"]?.jsonObject ?: buildJsonObject {}
                    val leaves = payload["leaves"]?.jsonObject ?: buildJsonObject {}
                    val current = _presenceMembers.value.toMutableList()
                    joins.keys.forEach { key ->
                        if (key !in current) current.add(key)
                    }
                    leaves.keys.forEach { key ->
                        current.remove(key)
                    }
                    _presenceMembers.value = current
                }
                "phx_reply" -> {
                    val status = payload["status"]?.jsonPrimitive?.content ?: ""
                    println("[$TAG] Reply status: $status")
                }
            }
        } catch (e: Exception) {
            println("[$TAG] Error handling message: ${e.message}")
        }
    }

    private fun nextRef(): String = (++refCounter).toString()
}
