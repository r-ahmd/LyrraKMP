package com.lyrra.app

import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Orchestrates "Listen Together" sessions. Manages host/listener roles,
 * broadcasts playback state from host, and applies received state on listeners.
 */
object ListenTogetherManager {
    private const val TAG = "ListenTogether"
    private const val SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co"
    private const val SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA"
    private const val SYNC_EVENT = "playback_sync"
    private const val SYNC_INTERVAL_MS = 2000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var realtime: SupabaseRealtime? = null
    private var syncJob: kotlinx.coroutines.Job? = null

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

    /** Callback interface for listener to apply playback commands. */
    interface PlaybackController {
        fun onSyncReceived(
            trackId: String,
            trackTitle: String,
            trackArtist: String,
            trackImageUrl: String?,
            positionMs: Long,
            isPlaying: Boolean,
            sourceType: String?,
            sourceId: String?,
        )
    }

    private val _state = MutableStateFlow(SessionState())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    var playbackController: PlaybackController? = null

    private val deviceName: String
        get() = "${Build.MANUFACTURER} ${Build.MODEL}"

    /** Host creates a new room. */
    fun createRoom(): String {
        val code = RoomCodeGenerator.generate()
        connect(code, Role.HOST)
        return code
    }

    /** Listener joins an existing room. */
    fun joinRoom(code: String) {
        connect(code.uppercase().trim(), Role.LISTENER)
    }

    /** Leave the current session. */
    fun leaveSession() {
        syncJob?.cancel()
        syncJob = null
        realtime?.disconnect()
        realtime = null
        _state.value = SessionState()
    }

    /** Host calls this to broadcast current playback state. */
    fun broadcastPlaybackState(
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
        val payload = JSONObject().apply {
            put("track_id", trackId)
            put("track_title", trackTitle)
            put("track_artist", trackArtist)
            put("track_image_url", trackImageUrl ?: "")
            put("position_ms", positionMs)
            put("is_playing", isPlaying)
            put("source_type", sourceType ?: "")
            put("source_id", sourceId ?: "")
            put("timestamp", System.currentTimeMillis())
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

        // Observe connection state and presence
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

        // Listen for incoming broadcast messages (listener side)
        if (role == Role.LISTENER) {
            scope.launch {
                for (msg in rt.incomingMessages) {
                    val event = msg.optString("event", "")
                    if (event == SYNC_EVENT) {
                        val payload = msg.optJSONObject("payload") ?: continue
                        val trackTitle = payload.optString("track_title", "")
                        val trackArtist = payload.optString("track_artist", "")
                        val isPlaying = payload.optBoolean("is_playing", false)

                        _state.value = _state.value.copy(
                            hostTrackTitle = trackTitle,
                            hostTrackArtist = trackArtist,
                            hostIsPlaying = isPlaying,
                        )

                        playbackController?.onSyncReceived(
                            trackId = payload.optString("track_id", ""),
                            trackTitle = trackTitle,
                            trackArtist = trackArtist,
                            trackImageUrl = payload.optString("track_image_url", "").ifEmpty { null },
                            positionMs = payload.optLong("position_ms", 0L),
                            isPlaying = isPlaying,
                            sourceType = payload.optString("source_type", "").ifEmpty { null },
                            sourceId = payload.optString("source_id", "").ifEmpty { null },
                        )
                    }
                }
            }
        }

        rt.connect(roomCode, "$deviceName (${if (role == Role.HOST) "Host" else "Listener"})")
    }
}
