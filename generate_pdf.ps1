param(
    [string]$InputText = "c:\Github projects\Android Projects\HR\geofencing-attendance-\AttendX_KMP_Spec_Prompt.txt",
    [string]$OutputFile = "c:\Github projects\Android Projects\HR\geofencing-attendance-\AttendX_KMP_Spec_Prompt.pdf"
)

Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = "Microsoft Print to PDF"
$doc.PrinterSettings.PrintToFile = $true
$doc.PrinterSettings.PrintFileName = $OutputFile

$global:allLines = Get-Content -LiteralPath $InputText -Encoding UTF8
$global:currentIndex = 0

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $ev)

    $font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $brush = [System.Drawing.Brushes]::Black
    $topMargin = 50
    $leftMargin = 50
    $lineHeight = 16
    $pageHeight = $ev.PageBounds.Height - 60
    $y = $topMargin

    while ($global:currentIndex -lt $global:allLines.Count -and ($y + $lineHeight) -lt $pageHeight) {
        $line = $global:allLines[$global:currentIndex]
        $ev.Graphics.DrawString($line, $font, $brush, [float]$leftMargin, [float]$y)
        $y += $lineHeight
        $global:currentIndex++
    }

    if ($global:currentIndex -lt $global:allLines.Count) {
        $ev.HasMorePages = $true
    } else {
        $ev.HasMorePages = $false
    }
}

$doc.add_PrintPage($handler)
$doc.Print()
Write-Output "PDF Generation Completed: $OutputFile"
