package com.tropicalshellfish.passbook

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.*
import androidx.work.*
import java.util.concurrent.TimeUnit
import com.tropicalshellfish.passbook.network.SalaryAdvanceSyncWorker
import com.tropicalshellfish.passbook.network.SupabaseClient
import com.tropicalshellfish.passbook.screens.AttendanceScreen
import com.tropicalshellfish.passbook.screens.DashboardScreen
import com.tropicalshellfish.passbook.screens.LeaveScreen
import com.tropicalshellfish.passbook.screens.LoginScreen
import com.tropicalshellfish.passbook.screens.NotificationsScreen
import com.tropicalshellfish.passbook.screens.PassbookScreen
import com.tropicalshellfish.passbook.screens.WithdrawScreen
import com.tropicalshellfish.passbook.ui.theme.PassbookTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            val workRequest = PeriodicWorkRequestBuilder<SalaryAdvanceSyncWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                "SalaryAdvanceSync",
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }

        setContent {
            PassbookTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    val isLoggedIn = SupabaseClient.auth.currentUserOrNull() != null
                    
                    NavHost(
                        navController = navController, 
                        startDestination = if (isLoggedIn) "dashboard" else "login"
                    ) {
                        composable("login") {
                            LoginScreen(
                                onLoginSuccess = {
                                    navController.navigate("dashboard") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("dashboard") {
                            DashboardScreen(
                                onNavigate = { route ->
                                    navController.navigate(route)
                                },
                                onLogout = {
                                    navController.navigate("login") {
                                        popUpTo(0) { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("passbook") {
                            PassbookScreen(
                                onWithdrawClicked = {
                                    navController.navigate("withdraw")
                                },
                                onNotificationsClicked = {
                                    navController.navigate("notifications")
                                },
                                onAttendanceClicked = {
                                    navController.navigate("attendance")
                                },
                                onLeaveClicked = {
                                    navController.navigate("leave")
                                }
                            )
                        }
                        composable("withdraw") {
                            WithdrawScreen(
                                onBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                        composable("notifications") {
                            NotificationsScreen(
                                onBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                        composable("attendance") {
                            AttendanceScreen(
                                onBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                        composable("leave") {
                            LeaveScreen(
                                onBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
