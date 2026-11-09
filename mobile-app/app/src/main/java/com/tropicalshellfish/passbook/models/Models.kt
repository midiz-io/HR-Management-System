package com.tropicalshellfish.passbook.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
data class Payroll(
    val id: String,
    val month: Int,
    val year: Int,
    @SerialName("netSalary") val netSalary: Double,
    val status: String,
    @SerialName("createdAt") val createdAt: String,
    @SerialName("paysheetUrl") val paysheetUrl: String? = null
)

@Serializable
data class SalaryAdvanceRequest(
    val id: String? = null,
    @SerialName("userId") val userId: String,
    @SerialName("requestDate") val requestDate: String,
    @SerialName("updatedAt") val updatedAt: String? = null,
    val amount: Double,
    val reason: String? = null,
    val status: String = "PENDING"
)

@Serializable
data class SalaryAdvanceInsert(
    @SerialName("userId") val userId: String,
    @SerialName("requestDate") val requestDate: String,
    @SerialName("updatedAt") val updatedAt: String,
    val amount: Double,
    val reason: String? = null,
    val status: String = "PENDING"
)
