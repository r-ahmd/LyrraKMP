package com.lyrra.shared

import android.content.Context
import android.os.Build
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Wrapper around Firebase Analytics and Supabase to centralize event logging.
 */
object Analytics {
    private var analytics: FirebaseAnalytics? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private const val SUPABASE_URL = "https://jzcnbbbzvsogkqkxdztm.supabase.co/rest/v1/analytics_events"
    private const val SUPABASE_KEY = "sb_publishable_enIYe3gEaqUcHp78L-VCFQ_K8G2dWtA"

    fun init(context: Context) {
        analytics = FirebaseAnalytics.getInstance(context)
    }

    fun logEvent(name: String, params: Bundle? = null) {
        analytics?.logEvent(name, params)
    }

    private fun logToSupabase(
        eventName: String,
        trackId: String? = null,
        trackTitle: String? = null,
        trackArtist: String? = null,
        query: String? = null
    ) {
        scope.launch {
            try {
                val url = URL(SUPABASE_URL)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("apikey", SUPABASE_KEY)
                conn.setRequestProperty("Authorization", "Bearer $SUPABASE_KEY")
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Prefer", "return=minimal")
                conn.doOutput = true

                val json = JSONObject().apply {
                    put("event_name", eventName)
                    put("track_id", trackId)
                    put("track_title", trackTitle)
                    put("track_artist", trackArtist)
                    put("query", query)
                    put("device_model", "${Build.MANUFACTURER} ${Build.MODEL}")
                }

                conn.outputStream.use { os ->
                    os.write(json.toString().toByteArray(Charsets.UTF_8))
                }
                conn.responseCode // execute
                conn.disconnect()
            } catch (_: Exception) {
                // Ignore network errors silently for analytics
            }
        }
    }

    // Specific event helpers
    fun logAppOpen() = logEvent(FirebaseAnalytics.Event.APP_OPEN)

    fun logSearch(query: String) {
        logEvent(FirebaseAnalytics.Event.SEARCH, Bundle().apply {
            putString(FirebaseAnalytics.Param.SEARCH_TERM, query)
        })
        logToSupabase("search", query = query)
    }
    fun logTrackPlayed(trackId: String, title: String, artist: String) {
        logEvent("track_played", Bundle().apply {
            putString("track_id", trackId)
            putString("track_title", title)
            putString("track_artist", artist)
        })
        logToSupabase("track_played", trackId, title, artist)
    }

    fun logTrackLiked(trackId: String, title: String, isLiked: Boolean) {
        logEvent("track_liked", Bundle().apply {
            putString("track_id", trackId)
            putString("track_title", title)
            putBoolean("is_liked", isLiked)
        })
        if (isLiked) {
            logToSupabase("track_liked", trackId, title)
        }
    }

    fun logTrackDownloaded(trackId: String, title: String) {
        logEvent("track_downloaded", Bundle().apply {
            putString("track_id", trackId)
            putString("track_title", title)
        })
        logToSupabase("track_downloaded", trackId, title)
    }

    fun logDiscoveryItemClicked(type: String, id: String, title: String) = logEvent("discovery_item_clicked", Bundle().apply {
        putString("item_type", type)
        putString("item_id", id)
        putString("item_title", title)
    })

    fun logPlaybackError(trackId: String, error: String) = logEvent("playback_error", Bundle().apply {
        putString("track_id", trackId)
        putString("error_message", error)
    })
}

