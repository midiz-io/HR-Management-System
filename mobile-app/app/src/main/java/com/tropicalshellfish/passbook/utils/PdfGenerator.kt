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
import java.util.Locale

fun generateAndSharePayslip(context: Context, monthTitle: String, netSalary: Double, status: String, dateStr: String) {
    val pdfDocument = PdfDocument()
    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
    val page = pdfDocument.startPage(pageInfo)
    val canvas: Canvas = page.canvas

    val paint = Paint().apply {
        color = Color.BLACK
        textSize = 14f
    }
    val titlePaint = Paint().apply {
        color = Color.rgb(16, 185, 129)
        textSize = 22f
        isFakeBoldText = true
    }
    val boldPaint = Paint().apply {
        color = Color.BLACK
        textSize = 14f
        isFakeBoldText = true
    }

    canvas.drawText("e-SMART PASSBOOK", 40f, 50f, titlePaint)
    
    paint.textSize = 12f
    paint.color = Color.GRAY
    canvas.drawText("Official Salary Statement / Payslip", 40f, 75f, paint)

    val linePaint = Paint().apply { color = Color.GRAY; strokeWidth = 2f }
    canvas.drawLine(40f, 95f, 555f, 95f, linePaint)

    var y = 140f
    canvas.drawText("Statement Period:", 40f, y, boldPaint)
    canvas.drawText(monthTitle, 180f, y, paint)

    y += 35f
    canvas.drawText("Deposit Date:", 40f, y, boldPaint)
    canvas.drawText(dateStr, 180f, y, paint)

    y += 35f
    canvas.drawText("Payment Status:", 40f, y, boldPaint)
    canvas.drawText(status, 180f, y, paint)

    y += 45f
    canvas.drawLine(40f, y, 555f, y, linePaint)

    y += 45f
    canvas.drawText("Earnings & Allowances", 40f, y, boldPaint)
    canvas.drawText("Amount (Rs.)", 400f, y, boldPaint)

    y += 35f
    canvas.drawText("Basic Salary / Net Earnings", 40f, y, paint)
    canvas.drawText(String.format(Locale.getDefault(), "Rs. %.2f", netSalary), 400f, y, paint)

    y += 45f
    canvas.drawLine(40f, y, 555f, y, linePaint)

    y += 50f
    val netPaint = Paint().apply {
        color = Color.rgb(16, 185, 129)
        textSize = 18f
        isFakeBoldText = true
    }
    canvas.drawText("Net Salary: Rs. ${String.format(Locale.getDefault(), "%.2f", netSalary)}", 40f, y, netPaint)

    y += 100f
    paint.color = Color.GRAY
    paint.textSize = 10f
    canvas.drawText("This is a computer-generated digital payslip via e-Smart Passbook system.", 40f, y, paint)

    pdfDocument.finishPage(page)

    val file = File(context.cacheDir, "Payslip_${monthTitle.replace("/", "_")}.pdf")
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
        context.startActivity(Intent.createChooser(intent, "Share Payslip PDF"))
    } catch (e: Exception) {
        e.printStackTrace()
    }
}
