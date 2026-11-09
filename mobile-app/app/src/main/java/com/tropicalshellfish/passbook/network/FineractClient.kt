package com.tropicalshellfish.passbook.network

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

data class FineractClientDto(
    val id: Long,
    val firstname: String,
    val lastname: String,
    val accountNo: String
)

data class LoanApplicationRequest(
    val clientId: Long,
    val productId: Long,
    val principal: Double,
    val loanTermFrequency: Int,
    val loanTermFrequencyType: Int = 0,
    val numberOfRepayments: Int = 1,
    val repaymentEvery: Int = 1,
    val repaymentFrequencyType: Int = 0,
    val transactionProcessingStrategyId: Long = 1,
    val expectedDisbursementDate: String,
    val submittedOnDate: String,
    val loanType: String = "individual"
)

data class LoanResponse(
    val loanId: Long,
    val resourceId: Long,
    val changes: Map<String, Any>? = null
)

interface FineractApiService {
    @GET("clients")
    suspend fun getClients(
        @Header("Fineract-Platform-TenantId") tenantId: String = "default"
    ): List<FineractClientDto>

    @POST("loans")
    suspend fun submitLoanApplication(
        @Header("Fineract-Platform-TenantId") tenantId: String = "default",
        @Body request: LoanApplicationRequest
    ): LoanResponse
}

object FineractClient {
    private const val BASE_URL = "https://demo.fineract.dev/fineract-provider/api/v1/"

    val api: FineractApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(FineractApiService::class.java)
    }
}
