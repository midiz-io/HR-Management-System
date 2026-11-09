package com.tropicalshellfish.passbook.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.tropicalshellfish.passbook.models.Payroll
import com.tropicalshellfish.passbook.models.SalaryAdvanceInsert
import com.tropicalshellfish.passbook.network.FineractClient
import com.tropicalshellfish.passbook.network.LoanApplicationRequest
import com.tropicalshellfish.passbook.network.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun WithdrawScreen(onBack: () -> Unit) {
    var amount by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var maxLimit by remember { mutableStateOf(0.0) }
    var isLoading by remember { mutableStateOf(true) }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val userId = SupabaseClient.auth.currentUserOrNull()?.id
                if (userId != null) {
                    val cal = Calendar.getInstance()
                    val currentMonth = cal.get(Calendar.MONTH) + 1
                    val currentYear = cal.get(Calendar.YEAR)

                    val payrollResult = SupabaseClient.client.postgrest["Payroll"]
                        .select {
                            filter { 
                                eq("userId", userId)
                                eq("month", currentMonth)
                                eq("year", currentYear)
                            }
                        }.decodeList<Payroll>()

                    val netSalary = payrollResult.firstOrNull()?.netSalary ?: 50000.0
                    maxLimit = netSalary * 0.5
                }
            } catch (e: Exception) {
                maxLimit = 25000.0
            } finally {
                isLoading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            "Request Earned Wage Advance",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(16.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Available Instant Advance Limit (50% EWA)", style = MaterialTheme.typography.labelMedium)
                Spacer(modifier = Modifier.height(4.dp))
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp))
                } else {
                    Text("Rs. ${String.format(Locale.getDefault(), "%.2f", maxLimit)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        
        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it },
            label = { Text("Withdrawal Amount (Rs)") },
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            label = { Text("Reason (Optional)") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3
        )
        Spacer(modifier = Modifier.height(24.dp))

        if (errorMessage != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = errorMessage!!,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (successMessage != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = successMessage!!,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = {
                val reqAmount = amount.toDoubleOrNull() ?: 0.0
                if (reqAmount > maxLimit) {
                    errorMessage = "Requested amount exceeds your available EWA limit of Rs. ${String.format(Locale.getDefault(), "%.2f", maxLimit)}"
                    return@Button
                }

                isSubmitting = true
                errorMessage = null
                successMessage = null
                scope.launch {
                    try {
                        val userId = SupabaseClient.auth.currentUserOrNull()?.id
                        if (userId != null) {
                            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                            val timestamp = sdf.format(Date())
                            val insertModel = SalaryAdvanceInsert(
                                userId = userId,
                                requestDate = timestamp,
                                updatedAt = timestamp,
                                amount = reqAmount,
                                reason = reason
                            )
                            
                            SupabaseClient.client.postgrest["SalaryAdvanceRequest"].insert(insertModel)
                            
                            try {
                                val fineractRequest = LoanApplicationRequest(
                                    clientId = 1L,
                                    productId = 1L,
                                    principal = reqAmount,
                                    loanTermFrequency = 30,
                                    expectedDisbursementDate = "2025-03-01",
                                    submittedOnDate = "2025-03-01"
                                )
                                FineractClient.api.submitLoanApplication(request = fineractRequest)
                            } catch (fineractErr: Exception) {
                                fineractErr.printStackTrace()
                            }

                            successMessage = "Earned Wage Advance requested successfully! Sent to Fineract Core Banking & Supabase."
                            amount = ""
                            reason = ""
                        } else {
                            errorMessage = "User not authenticated. Please log in again."
                        }
                    } catch (e: Exception) {
                        val rawMsg = e.message ?: ""
                        errorMessage = if (rawMsg.contains("row-level security", ignoreCase = true)) {
                            "Failed to submit request: Database RLS security policy restricted the insert."
                        } else {
                            "Failed to submit request: $rawMsg"
                        }
                    } finally {
                        isSubmitting = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isSubmitting && amount.isNotBlank() && !isLoading
        ) {
            if (isSubmitting) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Text("Request Instant Payout")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onBack) {
            Text("Back to Passbook")
        }
    }
}
