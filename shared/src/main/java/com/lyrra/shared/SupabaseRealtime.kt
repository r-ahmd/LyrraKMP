package com.lyrra.shared

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Low-level Supabase Realtime WebSocket client.
 * Handles channel join, broadcast send/receive, and presence tracking.
 */
class SupabaseRealtime(
    private val supabaseUrl: String,
    private val supabaseKey: String,
) {
    companion object {
        private const val TAG = "SupabaseRealtime"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var webSocket: WebSocket? = null
    private var refCounter = 0
    private var channelTopic: String? = null
    private var heartbeatJob: kotlinx.coroutines.Job? = null

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _presenceMembers = MutableStateFlow<List<String>>(emptyList())
    val presenceMembers: StateFlow<List<String>> = _presenceMembers.asStateFlow()

    /** Incoming broadcast messages. */
    val incomingMessages = Channel<JSONObject>(Channel.BUFFERED)

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // no timeout for WebSocket
        .build()

    /** Connect to Supabase Realtime and join a broadcast channel for the given room code. */
    fun connect(roomCode: String, displayName: String) {
        disconnect()

        val realtimeUrl = supabaseUrl
            .replace("https://", "wss://")
            .replace("http://", "ws://") +
            "/realtime/v1/websocket?apikey=$supabaseKey&vsn=1.0.0"

        channelTopic = "realtime:listen-together-$roomCode"

        val request = Request.Builder()
            .url(realtimeUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected")
                _isConnected.value = true
                joinChannel(displayName)
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closing: $code $reason")
                webSocket.close(1000, null)
                cleanup()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                cleanup()
            }
        })
    }

    /** Send a broadcast message to all channel members. */
    fun broadcast(event: String, payload: JSONObject) {
        val topic = channelTopic ?: return
        val msg = JSONObject().apply {
            put("topic", topic)
            put("event", "broadcast")
            put("payload", JSONObject().apply {
                put("type", "broadcast")
                put("event", event)
                put("payload", payload)
            })
            put("ref", nextRef())
        }
        webSocket?.send(msg.toString())
    }

    /** Disconnect and clean up. */
    fun disconnect() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        webSocket?.close(1000, "leaving")
        webSocket = null
        cleanup()
    }

    private fun cleanup() {
        _isConnected.value = false
        _presenceMembers.value = emptyList()
        channelTopic = null
    }

    private fun joinChannel(displayName: String) {
        val topic = channelTopic ?: return
        val joinMsg = JSONObject().apply {
            put("topic", topic)
            put("event", "phx_join")
            put("payload", JSONObject().apply {
                put("config", JSONObject().apply {
                    put("broadcast", JSONObject().apply {
                        put("self", false)
                        put("ack", false)
                    })
                    put("presence", JSONObject().apply {
                        put("key", displayName)
                    })
                })
            })
            put("ref", nextRef())
        }
        webSocket?.send(joinMsg.toString())

        // Send presence track payload so everyone sees this member
        val trackMsg = JSONObject().apply {
            put("topic", topic)
            put("event", "presence")
            put("payload", JSONObject().apply {
                put("event", "track")
                put("payload", JSONObject().apply {
                    put("online_at", System.currentTimeMillis())
                    put("name", displayName)
                })
            })
            put("ref", nextRef())
        }
        webSocket?.send(trackMsg.toString())
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (true) {
                kotlinx.coroutines.delay(HEARTBEAT_INTERVAL_MS)
                val msg = JSONObject().apply {
                    put("topic", "phoenix")
                    put("event", "heartbeat")
                    put("payload", JSONObject())
                    put("ref", nextRef())
                }
                webSocket?.send(msg.toString())
            }
        }
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val event = json.optString("event", "")
            val payload = json.optJSONObject("payload") ?: return

            when (event) {
                "broadcast" -> {
                    val broadcastEvent = payload.optString("event", "")
                    val innerPayload = payload.optJSONObject("payload") ?: payload
                    scope.launch {
                        incomingMessages.send(JSONObject().apply {
                            put("event", broadcastEvent)
                            put("payload", innerPayload)
                        })
                    }
                }
                "presence_state" -> {
                    // Initial presence state - extract all member keys
                    val members = mutableListOf<String>()
                    payload.keys().forEach { key -> members.add(key as String) }
                    _presenceMembers.value = members
                }
                "presence_diff" -> {
                    val joins = payload.optJSONObject("joins") ?: JSONObject()
                    val leaves = payload.optJSONObject("leaves") ?: JSONObject()
                    val current = _presenceMembers.value.toMutableList()
                    joins.keys().forEach { key -> if (key !in current) current.add(key as String) }
                    leaves.keys().forEach { key -> current.remove(key as String) }
                    _presenceMembers.value = current
                }
                "phx_reply" -> {
                    val status = payload.optString("status", "")
                    Log.d(TAG, "Reply status: $status")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling message", e)
        }
    }

    private fun nextRef(): String = (++refCounter).toString()
}
