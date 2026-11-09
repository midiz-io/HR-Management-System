package com.tropicalshellfish.passbook.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Close
import com.tropicalshellfish.passbook.utils.getNotificationHistory
import com.tropicalshellfish.passbook.utils.AppNotificationItem
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tropicalshellfish.passbook.R
import com.tropicalshellfish.passbook.models.Payroll
import com.tropicalshellfish.passbook.models.SalaryAdvanceRequest
import com.tropicalshellfish.passbook.network.SupabaseClient
import com.tropicalshellfish.passbook.utils.generateAndSharePayslip
import com.tropicalshellfish.passbook.utils.triggerNotification
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class Transaction(
    val id: String,
    val title: String,
    val subtitle: String,
    val amount: Double,
    val isDeposit: Boolean,
    val dateStr: String,
    val date: Date,
    val status: String,
    val paysheetUrl: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PassbookScreen(onWithdrawClicked: () -> Unit, onNotificationsClicked: () -> Unit, onAttendanceClicked: () -> Unit, onLeaveClicked: () -> Unit) {
    val context = LocalContext.current
    var transactions by remember { mutableStateOf<List<Transaction>>(emptyList()) }
    var rawAdvances by remember { mutableStateOf<List<SalaryAdvanceRequest>>(emptyList()) }
    var rawPayrolls by remember { mutableStateOf<List<Payroll>>(emptyList()) }
    var thisMonthSalary by remember { mutableStateOf(0.0) }
    var thisMonthStatus by remember { mutableStateOf("") }
    var isSalaryVisible by remember { mutableStateOf(true) }
    var isLoading by remember { mutableStateOf(true) }
    var selectedFilter by remember { mutableStateOf("All") }
    var selectedPayslipTx by remember { mutableStateOf<Transaction?>(null) }
    var showAdvanceHistoryDialog by remember { mutableStateOf(false) }
    var showQuickInfoDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val loadData = {
        scope.launch {
            try {
                val userId = SupabaseClient.auth.currentUserOrNull()?.id
                if (userId != null) {
                    val payrollResult = SupabaseClient.client.postgrest["Payroll"]
                        .select {
                            filter { eq("userId", userId) }
                        }.decodeList<Payroll>()
                    
                    val advanceResult = SupabaseClient.client.postgrest["SalaryAdvanceRequest"]
                        .select {
                            filter { eq("userId", userId) }
                        }.decodeList<SalaryAdvanceRequest>()

                    // Check for salary deposit / payroll process changes and notify automatically
                    payrollResult.forEach { newPayroll ->
                        val oldPayroll = rawPayrolls.find { it.id == newPayroll.id }
                        if (oldPayroll == null && newPayroll.status.equals("PAID", ignoreCase = true)) {
                            val msg = "Your monthly salary of Rs. ${String.format(Locale.getDefault(), "%.2f", newPayroll.netSalary)} has been successfully deposited!"
                            triggerNotification(context, "Salary Deposited", msg)
                        }
                    }
                    rawPayrolls = payrollResult

                    // Check for advance status changes and notify
                    advanceResult.forEach { newAdv ->
                        val oldAdv = rawAdvances.find { it.id == newAdv.id }
                        if (oldAdv != null && oldAdv.status.equals("PENDING", ignoreCase = true) && !newAdv.status.equals("PENDING", ignoreCase = true)) {
                            val formattedAmount = String.format(Locale.getDefault(), "%.2f", newAdv.amount)
                            val msg = "Your salary advance request of Rs. $formattedAmount is now: ${newAdv.status}"
                            triggerNotification(context, "Salary Advance Update", msg)
                        }
                    }
                    rawAdvances = advanceResult

                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                    val displaySdf = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                    val cal = Calendar.getInstance()
                    val currentMonth = cal.get(Calendar.MONTH) + 1
                    val currentYear = cal.get(Calendar.YEAR)

                    // Find this month's salary
                    val currentMonthPayroll = payrollResult.find { it.month == currentMonth && it.year == currentYear }
                    if (currentMonthPayroll != null) {
                        thisMonthSalary = currentMonthPayroll.netSalary
                        thisMonthStatus = currentMonthPayroll.status
                    } else {
                        val latest = payrollResult.maxByOrNull { it.year * 12 + it.month }
                        if (latest != null) {
                            thisMonthSalary = latest.netSalary
                            thisMonthStatus = latest.status
                        } else {
                            thisMonthStatus = "OUTSTANDING"
                        }
                    }

                    val mappedPayrolls = payrollResult.map { p ->
                        val date = try { sdf.parse(p.createdAt.take(19)) } catch(e: Exception) { Date() }
                        Transaction(
                            id = p.id,
                            title = "Salary - ${p.month}/${p.year}",
                            subtitle = "Payroll Deposit",
                            amount = p.netSalary,
                            isDeposit = true,
                            dateStr = displaySdf.format(date),
                            date = date,
                            status = p.status,
                            paysheetUrl = p.paysheetUrl
                        )
                    }

                    val mappedAdvances = advanceResult.map { a ->
                        val date = try { sdf.parse(a.requestDate.take(19)) } catch(e: Exception) { Date() }
                        Transaction(
                            id = a.id ?: UUID.randomUUID().toString(),
                            title = "Salary Advance",
                            subtitle = a.reason ?: "Withdrawal",
                            amount = a.amount,
                            isDeposit = false,
                            dateStr = displaySdf.format(date),
                            date = date,
                            status = a.status
                        )
                    }

                    val allTransactions = (mappedPayrolls + mappedAdvances).sortedByDescending { it.date }
                    transactions = allTransactions
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    // Active polling every 10 seconds for real-time updates and push notifications
    LaunchedEffect(Unit) {
        while (true) {
            loadData()
            delay(10000)
        }
    }

    val filteredTransactions = transactions.filter { tx ->
        when (selectedFilter) {
            "Paid" -> tx.isDeposit && tx.status.equals("PAID", ignoreCase = true)
            "Outstanding" -> (tx.isDeposit && !tx.status.equals("PAID", ignoreCase = true)) || (!tx.isDeposit && tx.status.equals("PENDING", ignoreCase = true))
            "Advances" -> !tx.isDeposit
            else -> true
        }
    }

    val isPaid = thisMonthStatus.equals("PAID", ignoreCase = true)
    val statusColor = if (isPaid) Color(0xFF10B981) else Color(0xFFEF4444)
    val statusText = if (isPaid) "PAID" else "OUTSTANDING / UNPAID"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "e-Smart Passbook",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            IconButton(onClick = onNotificationsClicked) {
                Icon(
                    imageVector = Icons.Default.Notifications,
                    contentDescription = "Notifications History",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))

        // Highlighted Available Balance / This Month Salary Card with Quick Peek Tap
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showQuickInfoDialog = true },
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                Image(
                    painter = painterResource(id = R.drawable.card_bg),
                    contentDescription = "Card Background",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize()
                )
                
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    "This Month Salary / Balance",
                                    color = Color.Black,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = "Tap for Quick Summary",
                                    tint = Color.Black.copy(alpha = 0.6f),
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val displayValue = if (isSalaryVisible) {
                                    "Rs. ${String.format(Locale.getDefault(), "%.2f", thisMonthSalary)}"
                                } else {
                                    "Rs. ******"
                                }
                                Text(
                                    displayValue,
                                    color = Color.Black,
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                IconButton(onClick = { isSalaryVisible = !isSalaryVisible }) {
                                    Icon(
                                        imageVector = if (isSalaryVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                        contentDescription = "Toggle Visibility",
                                        tint = Color.Black
                                    )
                                }
                            }
                        }
                    }

                    // Status Highlight Badge & Withdraw Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = statusColor.copy(alpha = 0.9f)
                        ) {
                            Text(
                                text = statusText,
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }

                        Button(
                            onClick = onWithdrawClicked,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
                        ) {
                            Text("Withdraw Advance", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Attendance Quick Access Banner
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onAttendanceClicked),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Attendance",
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Geofencing Attendance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text("Mark Check-In / Check-Out", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                    }
                }
                Button(
                    onClick = onAttendanceClicked,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Mark Attendance", fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Leave Management Quick Access Banner
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onLeaveClicked),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.EventNote,
                        contentDescription = "Leave",
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Leave Management", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text("Apply & Track Leaves", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
                    }
                }
                Button(
                    onClick = onLeaveClicked,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Manage Leave", fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Filters for Statement & Payslips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Statement & Payslips", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            TextButton(onClick = { showAdvanceHistoryDialog = true }) {
                Text("View Advance History")
            }
        }
        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("All", "Paid", "Outstanding", "Advances").forEach { filter ->
                FilterChip(
                    selected = selectedFilter == filter,
                    onClick = { selectedFilter = filter },
                    label = { Text(filter) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoading && transactions.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (filteredTransactions.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Text("No transactions found", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(filteredTransactions) { tx ->
                    val isTxPaid = tx.isDeposit && tx.status.equals("PAID", ignoreCase = true)

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
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                val iconBgColor = if (tx.isDeposit) {
                                    if (isTxPaid) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f)
                                } else {
                                    Color(0xFFEF4444).copy(alpha = 0.15f)
                                }
                                val iconColor = if (tx.isDeposit) {
                                    if (isTxPaid) Color(0xFF10B981) else Color(0xFFEF4444)
                                } else {
                                    Color(0xFFEF4444)
                                }

                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .background(iconBgColor),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = if (tx.isDeposit) Icons.Filled.Payments else Icons.Filled.CreditCard,
                                        contentDescription = "Salary / Advance Icon",
                                        tint = iconColor,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(16.dp))
                                Column {
                                    Text(tx.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(tx.dateStr, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(" • ", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(
                                            text = tx.status,
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isTxPaid) Color(0xFF10B981) else Color(0xFFEF4444)
                                        )
                                    }
                                }
                            }
                            
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = (if (tx.isDeposit) "+" else "-") + "Rs. ${String.format(Locale.getDefault(), "%.2f", tx.amount)}",
                                    fontWeight = FontWeight.Bold,
                                    color = if (tx.isDeposit) {
                                        if (isTxPaid) Color(0xFF10B981) else Color(0xFFEF4444)
                                    } else {
                                        Color(0xFFEF4444)
                                    }
                                )
                                
                                if (tx.isDeposit) {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    OutlinedButton(
                                        onClick = {
                                            generateAndSharePayslip(context, tx.title, tx.amount, tx.status, tx.dateStr)
                                        },
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                        modifier = Modifier.height(30.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Filled.PictureAsPdf,
                                            contentDescription = "PDF Payslip",
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("PDF Payslip", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Quick Salary Peek Dialog
    if (showQuickInfoDialog) {
        AlertDialog(
            onDismissRequest = { showQuickInfoDialog = false },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("This Month Net Salary:")
                    Text("Rs. ${String.format(Locale.getDefault(), "%.2f", thisMonthSalary)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text("Current Status: $thisMonthStatus", fontWeight = FontWeight.SemiBold)
                    Text("Tap anywhere on your balance card anytime for a quick peek.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            },
            confirmButton = {
                Button(onClick = { showQuickInfoDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Salary Advance History Dialog with Date Range & Status Filtration + 1-Minute Cancellation
    if (showAdvanceHistoryDialog) {
        var advanceStatusFilter by remember { mutableStateOf("All") }
        var advanceDateFilter by remember { mutableStateOf("All Time") }

        val sdfParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val calNow = Calendar.getInstance()

        val filteredAdvancesList = rawAdvances.filter { adv ->
            val matchesStatus = when (advanceStatusFilter) {
                "Pending" -> adv.status.equals("PENDING", ignoreCase = true)
                "Approved / Paid" -> adv.status.equals("PAID", ignoreCase = true) || adv.status.equals("APPROVED", ignoreCase = true)
                "Rejected" -> adv.status.equals("REJECTED", ignoreCase = true)
                "Cancelled" -> adv.status.equals("CANCELLED", ignoreCase = true)
                else -> true
            }

            val advDate = try { sdfParser.parse(adv.requestDate.take(19)) } catch (e: Exception) { Date() }
            val calAdv = Calendar.getInstance().apply { time = advDate }

            val matchesDate = when (advanceDateFilter) {
                "This Month" -> calAdv.get(Calendar.MONTH) == calNow.get(Calendar.MONTH) && calAdv.get(Calendar.YEAR) == calNow.get(Calendar.YEAR)
                "Last 30 Days" -> (calNow.timeInMillis - advDate.time) <= (30L * 24 * 60 * 60 * 1000)
                else -> true
            }

            matchesStatus && matchesDate
        }

        AlertDialog(
            onDismissRequest = { showAdvanceHistoryDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Default.History, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Salary Advance History")
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 500.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Filter by Status:", style = MaterialTheme.typography.labelMedium)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("All", "Pending", "Approved / Paid", "Rejected", "Cancelled").forEach { status ->
                            FilterChip(
                                selected = advanceStatusFilter == status,
                                onClick = { advanceStatusFilter = status },
                                label = { Text(status, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }

                    Text("Filter by Date Range:", style = MaterialTheme.typography.labelMedium)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("All Time", "This Month", "Last 30 Days").forEach { range ->
                            FilterChip(
                                selected = advanceDateFilter == range,
                                onClick = { advanceDateFilter = range },
                                label = { Text(range, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                    }

                    Divider()

                    if (filteredAdvancesList.isEmpty()) {
                        Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                            Text("No salary advance requests found.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(filteredAdvancesList) { adv ->
                                val advDate = try { sdfParser.parse(adv.requestDate.take(19)) } catch (e: Exception) { Date() }
                                val advDateStr = try {
                                    SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(advDate ?: Date())
                                } catch (e: Exception) {
                                    adv.requestDate.take(10)
                                }

                                // Check if within 1 minute (60,000 ms) and status is PENDING
                                val diffMillis = System.currentTimeMillis() - (advDate?.time ?: 0L)
                                val canCancel = adv.status.equals("PENDING", ignoreCase = true) && diffMillis <= 60000L

                                val statusBg = when {
                                    adv.status.equals("PAID", ignoreCase = true) || adv.status.equals("APPROVED", ignoreCase = true) -> Color(0xFF10B981)
                                    adv.status.equals("REJECTED", ignoreCase = true) || adv.status.equals("CANCELLED", ignoreCase = true) -> Color(0xFFEF4444)
                                    else -> Color(0xFFF59E0B)
                                }

                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("Rs. ${String.format(Locale.getDefault(), "%.2f", adv.amount)}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = statusBg.copy(alpha = 0.2f)
                                            ) {
                                                Text(
                                                    text = adv.status,
                                                    color = statusBg,
                                                    style = MaterialTheme.typography.labelSmall,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text("Date: $advDateStr", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        if (!adv.reason.isNullOrEmpty()) {
                                            Text("Reason: ${adv.reason}", style = MaterialTheme.typography.bodySmall)
                                        }

                                        // Cancel Button within 1 minute
                                        if (canCancel) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            OutlinedButton(
                                                onClick = {
                                                    scope.launch {
                                                        try {
                                                            val updateSdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                                                            SupabaseClient.client.postgrest["SalaryAdvanceRequest"].update(
                                                                mapOf("status" to "CANCELLED", "updatedAt" to updateSdf.format(Date()))
                                                            ) {
                                                                filter { eq("id", adv.id ?: "") }
                                                            }
                                                            loadData()
                                                        } catch (e: Exception) {
                                                            e.printStackTrace()
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
                                                modifier = Modifier.fillMaxWidth().height(32.dp)
                                            ) {
                                                Text("Cancel Request (Within 1 min)", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { showAdvanceHistoryDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Payslip Details / PDF Viewer Dialog
    if (selectedPayslipTx != null) {
        val tx = selectedPayslipTx!!
        AlertDialog(
            onDismissRequest = { selectedPayslipTx = null },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.PictureAsPdf,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Payslip Details")
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("e-Smart Passbook - Salary Statement", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Divider()
                    Text("Title: ${tx.title}")
                    Text("Date: ${tx.dateStr}")
                    Text("Net Salary: Rs. ${String.format(Locale.getDefault(), "%.2f", tx.amount)}", fontWeight = FontWeight.Bold)
                    Text("Status: ${tx.status}")
                    Spacer(modifier = Modifier.height(4.dp))
                    val url = tx.paysheetUrl
                    if (!url.isNullOrEmpty()) {
                        Text("PDF Link available:", style = MaterialTheme.typography.labelMedium)
                        Text(url, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                    } else {
                        Text("Digital payslip generated by e-Smart Passbook system.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val url = tx.paysheetUrl
                        if (!url.isNullOrEmpty()) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                context.startActivity(intent)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                        selectedPayslipTx = null
                    }
                ) {
                    val url = tx.paysheetUrl
                    Text(if (!url.isNullOrEmpty()) "Open PDF in Browser" else "Close")
                }
            },
            dismissButton = {
                val url = tx.paysheetUrl
                if (!url.isNullOrEmpty()) {
                    TextButton(onClick = { selectedPayslipTx = null }) {
                        Text("Close")
                    }
                }
            }
        )
    }
}
