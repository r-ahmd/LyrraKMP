package com.lyrra.shared

/** Generates short, human-friendly room codes for Listen Together sessions. */
object RoomCodeGenerator {
    private val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I to avoid confusion

    /** Returns a random 6-character room code like "K4HX9R". */
    fun generate(): String = buildString {
        repeat(6) { append(chars.random()) }
    }
}
