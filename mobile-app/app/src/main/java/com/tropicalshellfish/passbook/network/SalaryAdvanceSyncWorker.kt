package com.tropicalshellfish.passbook.network

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.tropicalshellfish.passbook.models.Payroll
import com.tropicalshellfish.passbook.models.SalaryAdvanceRequest
import com.tropicalshellfish.passbook.utils.triggerNotification
import io.github.jan.supabase.postgrest.postgrest
import java.util.Locale

class SalaryAdvanceSyncWorker(appContext: Context, workerParams: WorkerParameters) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        try {
            val userId = SupabaseClient.auth.currentUserOrNull()?.id
            if (userId != null) {
                val prefs = applicationContext.getSharedPreferences("PassbookPrefs", Context.MODE_PRIVATE)

                // 1. Check Salary Advance Requests Status Updates
                val advanceResult = SupabaseClient.client.postgrest["SalaryAdvanceRequest"]
                    .select {
                        filter { eq("userId", userId) }
                    }.decodeList<SalaryAdvanceRequest>()
                
                advanceResult.forEach { adv ->
                    val advId = adv.id ?: return@forEach
                    val lastStatus = prefs.getString("adv_$advId", "PENDING")
                    if (lastStatus == "PENDING" && !adv.status.equals("PENDING", ignoreCase = true)) {
                        val formattedAmount = String.format(Locale.getDefault(), "%.2f", adv.amount)
                        triggerNotification(applicationContext, "Salary Advance Update", "Your salary advance request of Rs. $formattedAmount is now: ${adv.status}")
                        prefs.edit().putString("adv_$advId", adv.status).apply()
                    } else if (lastStatus == null || lastStatus == "") {
                        prefs.edit().putString("adv_$advId", adv.status).apply()
                    }
                }

                // 2. Check Monthly Salary Deposit / Payroll Status
                val payrollResult = SupabaseClient.client.postgrest["Payroll"]
                    .select {
                        filter { eq("userId", userId) }
                    }.decodeList<Payroll>()

                payrollResult.forEach { payroll ->
                    val payrollId = payroll.id
                    val lastPayrollStatus = prefs.getString("payroll_$payrollId", "PENDING")
                    if (payroll.status.equals("PAID", ignoreCase = true) && lastPayrollStatus != "PAID") {
                        val formattedSalary = String.format(Locale.getDefault(), "%.2f", payroll.netSalary)
                        triggerNotification(
                            applicationContext,
                            "Salary Deposited 💰",
                            "Your monthly salary for ${payroll.month}/${payroll.year} of Rs. $formattedSalary has been successfully deposited! Tap to view PDF payslip."
                        )
                        prefs.edit().putString("payroll_$payrollId", "PAID").apply()
                    } else if (lastPayrollStatus == null || lastPayrollStatus == "") {
                        prefs.edit().putString("payroll_$payrollId", payroll.status).apply()
                    }
                }
            }
            return Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            return Result.retry()
        }
    }
}
