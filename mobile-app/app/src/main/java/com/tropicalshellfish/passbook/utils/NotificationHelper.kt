package com.tropicalshellfish.passbook.utils

import android.R
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tropicalshellfish.passbook.MainActivity
import java.text.SimpleDateFormat
import java.util.*

data class AppNotificationItem(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val dateStr: String
)

fun triggerNotification(context: Context, title: String, message: String) {
    try {
        saveNotificationToHistory(context, title, message)

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "PassbookNotificationChannel"
        
        val channel = NotificationChannel(channelId, "Passbook Updates", NotificationManager.IMPORTANCE_HIGH)
        notificationManager.createNotificationChannel(channel)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

fun saveNotificationToHistory(context: Context, title: String, message: String) {
    try {
        val prefs = context.getSharedPreferences("NotificationHistoryPrefs", Context.MODE_PRIVATE)
        val existingJson = prefs.getString("notifications_list", "[]") ?: "[]"
        val sdf = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
        val dateStr = sdf.format(Date())

        val gson = Gson()
        val type = object : TypeToken<MutableList<AppNotificationItem>>() {}.type
        val list: MutableList<AppNotificationItem> = try {
            gson.fromJson(existingJson, type) ?: mutableListOf()
        } catch (e: Exception) {
            mutableListOf()
        }

        list.add(0, AppNotificationItem(title = title, message = message, timestamp = System.currentTimeMillis(), dateStr = dateStr))
        val trimmed = if (list.size > 50) list.take(50) else list
        val newJson = gson.toJson(trimmed)
        prefs.edit().putString("notifications_list", newJson).apply()
    } catch (e: Exception) {
        e.printStackTrace()
    }
}

fun getNotificationHistory(context: Context): List<AppNotificationItem> {
    return try {
        val prefs = context.getSharedPreferences("NotificationHistoryPrefs", Context.MODE_PRIVATE)
        val json = prefs.getString("notifications_list", "[]") ?: "[]"
        val gson = Gson()
        val type = object : TypeToken<List<AppNotificationItem>>() {}.type
        gson.fromJson(json, type) ?: emptyList()
    } catch (e: Exception) {
        emptyList()
    }
}
