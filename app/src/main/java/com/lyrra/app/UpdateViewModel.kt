package com.lyrra.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class UpdateViewModel : ViewModel() {
    private val _updateState = MutableStateFlow<UpdateStatus>(UpdateStatus.Idle)
    val updateState: StateFlow<UpdateStatus> = _updateState.asStateFlow()

    fun checkForUpdates() {
        if (_updateState.value != UpdateStatus.Idle) return
        
        viewModelScope.launch {
            _updateState.value = UpdateStatus.Checking
            val update = UpdateChecker.checkForUpdate(BuildConfig.VERSION_NAME)
            if (update != null) {
                _updateState.value = UpdateStatus.UpdateAvailable(update)
            } else {
                _updateState.value = UpdateStatus.UpToDate
            }
        }
    }

    fun dismiss() {
        _updateState.value = UpdateStatus.Dismissed
    }
}

sealed interface UpdateStatus {
    data object Idle : UpdateStatus
    data object Checking : UpdateStatus
    data class UpdateAvailable(val update: UpdateChecker.AppUpdate) : UpdateStatus
    data object UpToDate : UpdateStatus
    data object Dismissed : UpdateStatus
}
