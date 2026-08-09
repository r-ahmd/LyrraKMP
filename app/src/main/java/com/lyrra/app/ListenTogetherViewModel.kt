package com.lyrra.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * ViewModel for the Listen Together UI. Exposes session state and actions.
 */
class ListenTogetherViewModel(application: Application) : AndroidViewModel(application) {

    val sessionState: StateFlow<ListenTogetherManager.SessionState> =
        ListenTogetherManager.state.stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5000),
            ListenTogetherManager.SessionState()
        )

    private val _roomCodeInput = MutableStateFlow("")
    val roomCodeInput: StateFlow<String> = _roomCodeInput.asStateFlow()

    private val _createdRoomCode = MutableStateFlow<String?>(null)
    val createdRoomCode: StateFlow<String?> = _createdRoomCode.asStateFlow()

    fun updateRoomCodeInput(input: String) {
        _roomCodeInput.value = input.uppercase().take(6)
    }

    fun createRoom() {
        val code = ListenTogetherManager.createRoom()
        _createdRoomCode.value = code
    }

    fun joinRoom() {
        val code = _roomCodeInput.value
        if (code.length == 6) {
            ListenTogetherManager.joinRoom(code)
        }
    }

    fun leaveSession() {
        ListenTogetherManager.leaveSession()
        _createdRoomCode.value = null
        _roomCodeInput.value = ""
    }
}
