package com.tropicalshellfish.passbook.utils

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

fun generateAndSharePrivacyPolicyPdf(context: Context) {
    val pdfDocument = PdfDocument()
    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
    val page = pdfDocument.startPage(pageInfo)
    val canvas: Canvas = page.canvas

    val paint = Paint().apply {
        color = Color.BLACK
        textSize = 12f
    }
    val titlePaint = Paint().apply {
        color = Color.rgb(16, 185, 129)
        textSize = 20f
        isFakeBoldText = true
    }
    val headingPaint = Paint().apply {
        color = Color.BLACK
        textSize = 13f
        isFakeBoldText = true
    }

    var y = 50f
    canvas.drawText("Privacy Policy - e-Smart Passbook", 40f, y, titlePaint)
    
    y += 22f
    paint.textSize = 10f
    paint.color = Color.GRAY
    canvas.drawText("Package: com.tropicalshellfish.passbook", 40f, y, paint)

    val lines = listOf(
        "",
        "Effective Date: March 8, 2025",
        "1. Introduction: Welcome to e-Smart Passbook.",
        "We respect your privacy and protect your personal data.",
        "",
        "2. Information We Collect:",
        "- Account Information: Email & authentication credentials via Supabase.",
        "- Attendance & Location: Geofencing location data for attendance.",
        "- Financial Data: Net salary, payroll history, and advance requests.",
        "- Device Data: Notification tokens for push notifications.",
        "",
        "3. How We Use Information:",
        "To authenticate users, verify attendance, process salary advances,",
        "generate PDF payslips, and send push notifications.",
        "",
        "4. Data Security:",
        "Data is stored securely with encryption via Supabase and RLS.",
        "",
        "5. Third-Party Services:",
        "Supabase (Backend/Auth) and Apache Fineract (Core Banking Ledger).",
        "",
        "6. Contact Us:",
        "Email: support@tropicalshellfish.com | Web: tropicalshellfish.com"
    )

    paint.color = Color.BLACK
    paint.textSize = 11f
    y += 15f

    for (line in lines) {
        if (line.startsWith("1.") || line.startsWith("2.") || line.startsWith("3.") || 
            line.startsWith("4.") || line.startsWith("5.") || line.startsWith("6.")) {
            y += 8f
            canvas.drawText(line, 40f, y, headingPaint)
        } else {
            canvas.drawText(line, 40f, y, paint)
        }
        y += 16f
    }

    pdfDocument.finishPage(page)

    val file = File(context.cacheDir, "Privacy_Policy_eSmart_Passbook.pdf")
    try {
        pdfDocument.writeTo(FileOutputStream(file))
    } catch (e: Exception) {
        e.printStackTrace()
    }
    pdfDocument.close()

    try {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Privacy Policy PDF"))
    } catch (e: Exception) {
        e.printStackTrace()
    }
}
