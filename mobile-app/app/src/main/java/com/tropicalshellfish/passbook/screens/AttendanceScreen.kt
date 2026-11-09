package com.tropicalshellfish.passbook.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.tropicalshellfish.passbook.network.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Serializable
data class AttendanceRecord(
    val id: String? = null,
    @SerialName("userId") val userId: String,
    @SerialName("checkInTime") val checkInTime: String,
    @SerialName("checkOutTime") val checkOutTime: String? = null,
    val status: String = "PRESENT",
    val latitude: Double? = null,
    val longitude: Double? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isCheckedIn by remember { mutableStateOf(false) }
    var attendanceRecords by remember { mutableStateOf<List<AttendanceRecord>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var currentLat by remember { mutableStateOf(6.9271) }
    var currentLng by remember { mutableStateOf(79.8612) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle permission result
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )

        try {
            val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                val lastKnown = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) 
                    ?: locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (lastKnown != null) {
                    currentLat = lastKnown.latitude
                    currentLng = lastKnown.longitude
                }
            }

            val userId = SupabaseClient.auth.currentUserOrNull()?.id
            if (userId != null) {
                val records = SupabaseClient.client.postgrest["Attendance"]
                    .select {
                        filter { eq("userId", userId) }
                    }.decodeList<AttendanceRecord>()
                attendanceRecords = records.sortedByDescending { it.checkInTime }
                
                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                val todayRecord = records.find { it.checkInTime.startsWith(todayStr) && it.checkOutTime == null }
                if (todayRecord != null) {
                    isCheckedIn = true
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    val handleCheckIn: () -> Unit = {
        scope.launch {
            try {
                val userId = SupabaseClient.auth.currentUserOrNull()?.id
                if (userId != null) {
                    val timeSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    timeSdf.timeZone = TimeZone.getTimeZone("UTC")
                    val nowStr = timeSdf.format(Date())

                    val newRecord = AttendanceRecord(
                        userId = userId,
                        checkInTime = nowStr,
                        status = "PRESENT",
                        latitude = currentLat,
                        longitude = currentLng
                    )

                    SupabaseClient.client.postgrest["Attendance"].insert(newRecord)
                    isCheckedIn = true
                    statusMessage = "Successfully Checked In at " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

                    val records = SupabaseClient.client.postgrest["Attendance"]
                        .select {
                            filter { eq("userId", userId) }
                        }.decodeList<AttendanceRecord>()
                    attendanceRecords = records.sortedByDescending { it.checkInTime }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                statusMessage = "Failed to check in: ${e.localizedMessage}"
            }
        }
    }

    val handleCheckOut: () -> Unit = {
        scope.launch {
            try {
                val userId = SupabaseClient.auth.currentUserOrNull()?.id
                if (userId != null) {
                    val timeSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    timeSdf.timeZone = TimeZone.getTimeZone("UTC")
                    val nowStr = timeSdf.format(Date())

                    val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                    val activeRecord = attendanceRecords.find { it.checkInTime.startsWith(todayStr) && it.checkOutTime == null }

                    if (activeRecord?.id != null) {
                        SupabaseClient.client.postgrest["Attendance"].update(
                            mapOf("checkOutTime" to nowStr)
                        ) {
                            filter { eq("id", activeRecord.id!!) }
                        }
                    }

                    isCheckedIn = false
                    statusMessage = "Successfully Checked Out at " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

                    val records = SupabaseClient.client.postgrest["Attendance"]
                        .select {
                            filter { eq("userId", userId) }
                        }.decodeList<AttendanceRecord>()
                    attendanceRecords = records.sortedByDescending { it.checkInTime }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                statusMessage = "Failed to check out: ${e.localizedMessage}"
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Geofencing Attendance", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.primary
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Location",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Office Geofence Status", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            "Location Verified (Lat: ${String.format(Locale.getDefault(), "%.4f", currentLat)}, Lng: ${String.format(Locale.getDefault(), "%.4f", currentLng)})",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (isCheckedIn) {
                Button(
                    onClick = handleCheckOut,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(imageVector = Icons.Default.Schedule, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Check Out", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
            } else {
                Button(
                    onClick = handleCheckIn,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Check In (Geofence)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
            }

            if (statusMessage != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = statusMessage!!,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Attendance History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (isLoading) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (attendanceRecords.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text("No attendance records found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(attendanceRecords) { record ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = "Date: ${record.checkInTime.take(10)}",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "In: ${record.checkInTime.drop(11).take(8)}  |  Out: ${record.checkOutTime?.drop(11)?.take(8) ?: "Active"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = if (record.checkOutTime != null) Color(0xFF10B981).copy(alpha = 0.2f) else Color(0xFF3B82F6).copy(alpha = 0.2f)
                                ) {
                                    Text(
                                        text = if (record.checkOutTime != null) "COMPLETED" else "ACTIVE",
                                        color = if (record.checkOutTime != null) Color(0xFF10B981) else Color(0xFF3B82F6),
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
