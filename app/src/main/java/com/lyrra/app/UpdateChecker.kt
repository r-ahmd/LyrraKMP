package com.lyrra.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONObject

/**
 * Checks for app updates by querying the GitHub Releases API.
 */
object UpdateChecker {
    private const val GITHUB_REPO = "r-ahmd/Lyrra"
    private const val LATEST_RELEASE_URL = "https://api.github.com/repos/$GITHUB_REPO/releases/latest"

    data class AppUpdate(
        val version: String,
        val changelog: String,
        val releaseUrl: String,
        val directDownloadUrl: String?,
        val fileName: String
    )

    suspend fun checkForUpdate(currentVersion: String): AppUpdate? = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url(LATEST_RELEASE_URL)
                .header("Accept", "application/vnd.github.v3+json")
                .header("User-Agent", "Lyrra-App")
                .build()

            YtHttpClients.client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val body = response.body?.string() ?: return@withContext null
                val json = JSONObject(body)
                val tagName = json.getString("tag_name").removePrefix("v")
                
                if (isNewer(tagName, currentVersion)) {
                    val asset = json.optJSONArray("assets")?.optJSONObject(0)
                    AppUpdate(
                        version = tagName,
                        changelog = json.optString("body", "No changelog provided."),
                        releaseUrl = json.optString("html_url", "https://github.com/r-ahmd/Lyrra/releases"),
                        directDownloadUrl = asset?.optString("browser_download_url"),
                        fileName = asset?.optString("name") ?: "Lyrra-latest.apk"
                    )
                } else null
            }
        }.getOrNull()
    }

    private fun isNewer(latest: String, current: String): Boolean {
        val latestParts = latest.split(".").mapNotNull { it.toIntOrNull() }
        val currentParts = current.split(".").mapNotNull { it.toIntOrNull() }
        
        val size = maxOf(latestParts.size, currentParts.size)
        for (i in 0 until size) {
            val l = latestParts.getOrNull(i) ?: 0
            val c = currentParts.getOrNull(i) ?: 0
            if (l > c) return true
            if (l < c) return false
        }
        return false
    }
}
