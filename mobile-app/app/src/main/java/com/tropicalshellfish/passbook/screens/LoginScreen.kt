package com.tropicalshellfish.passbook.screens

import android.content.Context
import android.content.ContextWrapper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import coil.compose.AsyncImage
import com.tropicalshellfish.passbook.network.SupabaseClient
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.coroutines.launch

fun Context.findActivity(): FragmentActivity? = when (this) {
    is FragmentActivity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    val context = LocalContext.current
    val sharedPref = remember { context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE) }
    
    var email by remember { mutableStateOf(sharedPref.getString("email", "") ?: "") }
    var password by remember { mutableStateOf(sharedPref.getString("password", "") ?: "") }
    var rememberMe by remember { mutableStateOf(sharedPref.getBoolean("remember_me", false)) }
    
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    val scope = rememberCoroutineScope()
    val activity = context.findActivity()

    val launchBiometric = {
        if (activity != null) {
            val executor = ContextCompat.getMainExecutor(context)
            val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    val savedEmail = sharedPref.getString("email", "") ?: email
                    val savedPass = sharedPref.getString("password", "") ?: password
                    if (savedEmail.isNotBlank() && savedPass.isNotBlank()) {
                        isLoading = true
                        scope.launch {
                            try {
                                SupabaseClient.auth.signInWith(Email) {
                                    this.email = savedEmail
                                    this.password = savedPass
                                }
                                onLoginSuccess()
                            } catch (e: Exception) {
                                errorMessage = "Biometric login failed: ${e.localizedMessage}"
                                isLoading = false
                            }
                        }
                    } else {
                        errorMessage = "Please enter Email & Password first to enable biometric login."
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    errorMessage = "Biometric error: $errString"
                }
            })

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Tropical Shell Fish Staff")
                .setSubtitle("Authenticate using your fingerprint or face ID")
                .setNegativeButtonText("Cancel")
                .build()

            biometricPrompt.authenticate(promptInfo)
        } else {
            errorMessage = "Biometric authentication not supported on this device/context."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        AsyncImage(
            model = "https://i.ibb.co/BKSmm8mb/GHDev-2026-10-04-20-13-25.jpg",
            contentDescription = "App Logo",
            modifier = Modifier.size(120.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(text = "Tropical Shell Fish Staff", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(text = "Enterprise HR Login", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(32.dp))
        
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(
                checked = rememberMe,
                onCheckedChange = { rememberMe = it }
            )
            Text("Remember me & enable Biometric")
        }

        if (errorMessage != null) {
            Text(text = errorMessage!!, color = MaterialTheme.colorScheme.error)
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = {
                isLoading = true
                errorMessage = null
                
                with(sharedPref.edit()) {
                    if (rememberMe) {
                        putString("email", email)
                        putString("password", password)
                        putBoolean("remember_me", true)
                    } else {
                        remove("email")
                        remove("password")
                        putBoolean("remember_me", false)
                    }
                    apply()
                }

                scope.launch {
                    try {
                        SupabaseClient.auth.signInWith(Email) {
                            this.email = email
                            this.password = password
                        }
                        onLoginSuccess()
                    } catch (e: Exception) {
                        errorMessage = "Invalid log in credentials"
                    } finally {
                        isLoading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading && email.isNotBlank() && password.isNotBlank()
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Text("Login with Password")
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        OutlinedButton(
            onClick = {
                if (email.isNotBlank() && password.isNotBlank()) {
                    with(sharedPref.edit()) {
                        putString("email", email)
                        putString("password", password)
                        putBoolean("remember_me", true)
                        apply()
                    }
                }
                launchBiometric()
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(imageVector = Icons.Default.Fingerprint, contentDescription = "Biometric")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Login with Biometric (Fingerprint / Face ID)")
        }
    }
}
