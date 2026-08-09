package com.lyrra.shared

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

/**
 * Orchestrates "Listen Together" sessions. Manages host/listener roles,
 * broadcasts playback state from host, and applies received state on listeners.
 */
object ListenTogetherManager {
    private const val TAG = "ListenTogether"
    private const val SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co"
    private const val SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA"
    private const val SYNC_EVENT = "playback_sync"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var realtime: SupabaseRealtime? = null

    enum class Role { NONE, HOST, LISTENER }

    data class SessionState(
        val role: Role = Role.NONE,
        val roomCode: String = "",
        val isConnected: Boolean = false,
        val members: List<String> = emptyList(),
        val hostTrackTitle: String = "",
        val hostTrackArtist: String = "",
        val hostIsPlaying: Boolean = false,
    )

    interface PlaybackController {
        fun onSyncReceived(
            trackId: String,
            trackTitle: String,
            trackArtist: String,
            trackImageUrl: String,
            positionMs: Long,
            isPlaying: Boolean,
            sourceType: String,
            sourceId: String,
        )
    }

    var playbackController: PlaybackController? = null

    private val _state = MutableStateFlow(SessionState())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    fun createRoom(): String {
        val roomCode = RoomCodeGenerator.generate()
        connect(roomCode, Role.HOST)
        return roomCode
    }

    fun joinRoom(roomCode: String): Boolean {
        val cleanCode = roomCode.trim().uppercase()
        if (cleanCode.length != 6) return false
        connect(cleanCode, Role.LISTENER)
        return true
    }

    fun leaveSession() {
        realtime?.disconnect()
        realtime = null
        _state.value = SessionState()
    }

    fun broadcastState(
        trackId: String,
        trackTitle: String,
        trackArtist: String,
        trackImageUrl: String?,
        positionMs: Long,
        isPlaying: Boolean,
        sourceType: String?,
        sourceId: String?,
    ) {
        if (_state.value.role != Role.HOST) return
        val payload = buildJsonObject {
            put("track_id", trackId)
            put("track_title", trackTitle)
            put("track_artist", trackArtist)
            put("track_image_url", trackImageUrl ?: "")
            put("position_ms", positionMs)
            put("is_playing", isPlaying)
            put("source_type", sourceType ?: "")
            put("source_id", sourceId ?: "")
        }
        realtime?.broadcast(SYNC_EVENT, payload)
    }

    private fun connect(roomCode: String, role: Role) {
        leaveSession()

        val rt = SupabaseRealtime(SUPABASE_URL, SUPABASE_KEY)
        realtime = rt

        _state.value = SessionState(
            role = role,
            roomCode = roomCode,
            isConnected = false,
        )

        scope.launch {
            rt.isConnected.collect { connected ->
                _state.value = _state.value.copy(isConnected = connected)
            }
        }
        scope.launch {
            rt.presenceMembers.collect { members ->
                _state.value = _state.value.copy(members = members)
            }
        }

        if (role == Role.LISTENER) {
            scope.launch {
                for (msg in rt.incomingMessages) {
                    val event = msg["event"]?.jsonPrimitive?.content ?: ""
                    if (event == SYNC_EVENT) {
                        val payload = msg["payload"]?.jsonObject ?: continue
                        val trackTitle = payload["track_title"]?.jsonPrimitive?.content ?: ""
                        val trackArtist = payload["track_artist"]?.jsonPrimitive?.content ?: ""
                        val isPlaying = payload["is_playing"]?.jsonPrimitive?.booleanOrNull ?: false

                        _state.value = _state.value.copy(
                            hostTrackTitle = trackTitle,
                            hostTrackArtist = trackArtist,
                            hostIsPlaying = isPlaying,
                        )

                        playbackController?.onSyncReceived(
                            trackId = payload["track_id"]?.jsonPrimitive?.content ?: "",
                            trackTitle = trackTitle,
                            trackArtist = trackArtist,
                            trackImageUrl = payload["track_image_url"]?.jsonPrimitive?.content ?: "",
                            positionMs = payload["position_ms"]?.jsonPrimitive?.longOrNull ?: 0L,
                            isPlaying = isPlaying,
                            sourceType = payload["source_type"]?.jsonPrimitive?.content ?: "",
                            sourceId = payload["source_id"]?.jsonPrimitive?.content ?: "",
                        )
                    }
                }
            }
        }

        val displayName = if (role == Role.HOST) "Host" else "Listener"
        rt.connectAndJoin(roomCode, displayName)
    }
}
