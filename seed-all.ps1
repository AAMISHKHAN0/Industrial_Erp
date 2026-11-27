param([int]$Volume = 1)

$ErrorActionPreference = "Continue"
$API = "http://localhost:4000/api/v1"
$anonKey = "sb_publishable_QTV7NpPOpLODQO9CZMFOnA_bvtAJFJM"
$startTime = Get-Date

function Log($msg, $color = "White") { Write-Host "$(Get-Date -Format 'HH:mm:ss') | $msg" -ForegroundColor $color }
function Ok($msg) { Log "OK  $msg" "Green" }
function Fail($msg) { Log "FAIL $msg" "Red" }
function Warn($msg) { Log "WARN $msg" "Yellow" }

# Authenticate
try {
  $login = Invoke-RestMethod -Uri "https://djfdkzbfavhwvnacmnxr.supabase.co/auth/v1/token?grant_type=password" -Method Post -Headers @{ "apikey" = $anonKey; "Content-Type" = "application/json" } -Body (@{ email = "pg1959655@gmail.com"; password = "aamishkhan1122" } | ConvertTo-Json) -ErrorAction Stop
  $token = $login.access_token
  $h = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
  Ok "Authenticated as $($login.user.email)"
} catch { Fail "Auth failed: $_"; exit 1 }

function Api($method, $path, $body = $null) {
  $uri = "${API}${path}"
  $params = @{ Uri = $uri; Method = $method; Headers = $h; ContentType = "application/json" }
  if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
  try { return (Invoke-RestMethod @params -ErrorAction Stop) } catch { return $null }
}

function Check($method, $path, $body = $null, $expectSuccess = $true) {
  $t = Get-Date
  $r = Api $method $path $body
  $elapsed = (Get-Date) - $t
  $ms = [math]::Round($elapsed.TotalMilliseconds)
  if (-not $r) { return $null }
  if ($expectSuccess -and $r.success -eq $false) { return $null }
  if ($ms -gt 5000) { Warn "${path} took ${ms}ms" }
  return $r
}

$M = $Volume * 50  # Scale volume

# ============ SECTION 1: MASTER DATA ============
Log "=== MASTER DATA ===" "Cyan"

# Departments
$deptIds = @{}
1..$M | ForEach-Object {
  $d = Check "POST" "/master-data/department" @{ name = "Department $_"; code = "DEPT-$_" }
  if ($d -and $d.data) { $deptIds["DEPT-$_"] = $d.data.id; Ok "Department $_" } else { Warn "Department $_ failed" }
}

# Designations
$desigIds = @{}
1..$M | ForEach-Object {
  $d = Check "POST" "/master-data/designation" @{ name = "Designation $_"; code = "DSG-$_" }
  if ($d -and $d.data) { $desigIds["DSG-$_"] = $d.data.id; Ok "Designation $_" } else { Warn "Designation $_ failed" }
}

# Branches
$branchIds = @{}
1..$M | ForEach-Object {
  $b = Check "POST" "/master-data/branch" @{ name = "Branch $_"; code = "BR-$_"; city = "City $_" }
  if ($b -and $b.data) { $branchIds["BR-$_"] = $b.data.id; Ok "Branch $_" } else { Warn "Branch $_ failed" }
}

# Employees
$empIds = @{}
1..$M | ForEach-Object {
  $deptKey = "DEPT-$((($_ - 1) % $M) + 1)"
  $desigKey = "DSG-$((($_ - 1) % $M) + 1)"
  $e = Check "POST" "/master-data/employee" @{
    employeeCode = "EMP-$_"; firstName = "First$_"; lastName = "Last$_"
    email = "emp${_}@test.com"; departmentId = $deptIds[$deptKey]; designationId = $desigIds[$desigKey]
  }
  if ($e -and $e.data) { $empIds["EMP-$_"] = $e.data.id; Ok "Employee $_" } else { Warn "Employee $_ failed" }
}

# ============ SECTION 2: INVENTORY ============
Log "=== INVENTORY ===" "Cyan"

# Units
$unitIds = @{}
@("Meter","Kg","Piece","Roll","Ton","Liter","Box","Set","Dozen","Pair") | ForEach-Object {
  $u = Check "POST" "/inventory/units" @{ name = $_; code = $_.Substring(0, [Math]::Min(3, $_.Length)).ToUpper() }
  if ($u -and $u.data) { $unitIds[$_] = $u.data.id }
}
Ok "Units: $($unitIds.Count) created"

# Categories
$catIds = @{}
@("Yarn","Fabric","Thread","Dye","Accessories","Chemicals","Spare Parts","Packaging","Raw Material","Finished Goods") | ForEach-Object {
  $c = Check "POST" "/inventory/categories" @{ name = $_; code = $_.Substring(0, [Math]::Min(3, $_.Length)).ToUpper() }
  if ($c -and $c.data) { $catIds[$_] = $c.data.id }
}
Ok "Categories: $($catIds.Count) created"

# Items (bulk)
$itemIds = @{}
$unitKeys = @($unitIds.Keys)
$catKeys = @($catIds.Keys)
($M * 2) | ForEach-Object {
  $uk = $unitKeys[($_ - 1) % $unitKeys.Count]
  $ck = $catKeys[($_ - 1) % $catKeys.Count]
  $i = Check "POST" "/inventory/items" @{
    itemCode = "ITEM-$_"; name = "Test Item $_"; categoryId = $catIds[$ck]; unitId = $unitIds[$uk];
    reorderLevel = 100
  }
  if ($i -and $i.data) { $itemIds["ITEM-$_"] = $i.data.id } else { Warn "Item $_ failed" }
}
Ok "Items: $($itemIds.Count) created"

# Warehouses
$warehouseIds = @{}
($M) | ForEach-Object {
  $branchKey = "BR-$((($_ - 1) % $M) + 1)"
  $w = Check "POST" "/inventory/warehouses" @{
    name = "Warehouse $_"; code = "WH-$_"; branchId = $branchIds[$branchKey]; city = "City $_"
  }
  if ($w -and $w.data) { $warehouseIds["WH-$_"] = $w.data.id } else { Warn "Warehouse $_ failed" }
}
Ok "Warehouses: $($warehouseIds.Count) created"

# ============ SECTION 3: PURCHASE ============
Log "=== PURCHASE ===" "Cyan"

# Vendors
$vendorIds = @{}
$M | ForEach-Object {
  $v = Check "POST" "/purchase/vendors" @{
    vendorCode = "V-$_; name = "Vendor $_"; contactPerson = "Person $_"; city = "City $_"; status = "ACTIVE"
  }
  if ($v -and $v.data) { $vendorIds["V-$_"] = $v.data.id; Ok "Vendor $_" } else { Warn "Vendor $_ failed" }
}

# Link vendors to items
$vendorKeys = @($vendorIds.Keys)
$itemKeys = @($itemIds.Keys)
$M | ForEach-Object {
  $vk = $vendorKeys[($_ - 1) % $vendorKeys.Count]
  $ik = $itemKeys[($_ - 1) % $itemKeys.Count]
  $i = Check "POST" "/purchase/vendors/$($vendorIds[$vk])/items" @{ itemIds = @($itemIds[$ik]) }
  if (-not $i) { Warn "Link vendor $_ failed" }
}
Ok "Vendor items linked"

# Demand Notes
$demandIds = @{}
$deptKeys = @($deptIds.Keys)
$M | ForEach-Object {
  $dk = $deptKeys[($_ - 1) % $deptKeys.Count]
  $d = Check "POST" "/purchase/demand-notes" @{
    demandNumber = "DN-$_; departmentId = $deptIds[$dk]; priority = @("LOW","MEDIUM","HIGH","URGENT")[($_ - 1) % 4]
  }
  if ($d -and $d.data) { $demandIds["DN-$_"] = $d.data.id; Ok "Demand Note $_" } else { Warn "Demand Note $_ failed" }
}

# Quotations
$quotIds = @{}
$M | ForEach-Object {
  $vk = $vendorKeys[($_ - 1) % $vendorKeys.Count]
  $dKey = "DN-$((($_ - 1) % $M) + 1)"
  $q = Check "POST" "/purchase/quotations" @{
    quotationNumber = "QT-$_; vendorId = $vendorIds[$vk]; demandNoteId = $demandIds[$dKey]
    items = @(@{ itemId = $itemIds["ITEM-$_"]; quantity = 100; unitPrice = 10.5; totalPrice = 1050 })
  }
  if ($q -and $q.data) { $quotIds["QT-$_"] = $q.data.id; Ok "Quotation $_" } else { Warn "Quotation $_ failed" }
}

# Purchase Orders
$poIds = @{}
$M | ForEach-Object {
  $vk = $vendorKeys[($_ - 1) % $vendorKeys.Count]
  $qKey = "QT-$((($_ - 1) % $M) + 1)"
  $po = Check "POST" "/purchase/orders" @{
    poNumber = "PO-$_; vendorId = $vendorIds[$vk]; quotationId = $quotIds[$qKey]
    items = @(@{ itemId = $itemIds["ITEM-$_"]; quantity = 100; unitPrice = 10.5; totalPrice = 1050 })
  }
  if ($po -and $po.data) { $poIds["PO-$_"] = $po.data.id; Ok "PO $_" } else { Warn "PO $_ failed" }
}

# Approve POs
$M | ForEach-Object {
  $pKey = "PO-$_"
  if ($poIds[$pKey]) {
    $r = Check "POST" "/purchase/orders/$($poIds[$pKey])/approve" $null
    if ($r) { Ok "PO $_ approved" } else { Warn "PO $_ approve failed" }
  }
}

# GRN
$M | ForEach-Object {
  $pKey = "PO-$_"
  $vk = $vendorKeys[($_ - 1) % $vendorKeys.Count]
  $whKey = "WH-$((($_ - 1) % $M) + 1)"
  if ($poIds[$pKey] -and $warehouseIds[$whKey]) {
    $grn = Check "POST" "/purchase/goods-receiving" @{
      grnNumber = "GRN-$_; poId = $poIds[$pKey]; vendorId = $vendorIds[$vk]; warehouseId = $warehouseIds[$whKey]
      items = @(@{ itemId = $itemIds["ITEM-$_"]; orderedQty = 100; receivedQty = 95; acceptedQty = 93; rejectedQty = 2; unitCost = 10.5 })
    }
    if ($grn) { Ok "GRN $_" } else { Warn "GRN $_ failed" }
  }
}

# ============ SECTION 4: PRODUCTION ============
Log "=== PRODUCTION ===" "Cyan"

# BOMs
$bomIds = @{}
$M | ForEach-Object {
  $bm = Check "POST" "/production/bom" @{
    bomNumber = "BOM-$_; itemId = $itemIds["ITEM-$_"]; quantity = 1; unit = "Piece"
    materials = @(@{ itemId = $itemIds["ITEM-$_"]; quantity = 2; unit = "Piece" })
  }
  if ($bm -and $bm.data) { $bomIds["BOM-$_"] = $bm.data.id; Ok "BOM $_" } else { Warn "BOM $_ failed" }
}

# Production Orders
$prodIds = @{}
$M | ForEach-Object {
  $bKey = "BOM-$((($_ - 1) % $M) + 1)"
  $po = Check "POST" "/production/orders" @{
    productionNumber = "PROD-$_; itemId = $itemIds["ITEM-$_"]; bomId = $bomIds[$bKey]; quantity = 100; priority = "MEDIUM"
  }
  if ($po -and $po.data) { $prodIds["PROD-$_"] = $po.data.id; Ok "Prod Order $_" } else { Warn "Prod Order $_ failed" }
}

# Quality Checks
$M | ForEach-Object {
  $pKey = "PROD-$_"
  if ($prodIds[$pKey]) {
    $qc = Check "POST" "/production/quality" @{
      productionOrderId = $prodIds[$pKey]; parameter = "Strength Test"; specification = ">30 N/mm"; result = "35 N/mm"; status = "PASS"
    }
    if ($qc) { Ok "QC $_" } else { Warn "QC $_ failed" }
  }
}

# ============ SECTION 5: SALES ============
Log "=== SALES ===" "Cyan"

# Customers
$custIds = @{}
$M | ForEach-Object {
  $c = Check "POST" "/sales/customers" @{
    customerCode = "CUST-$_; name = "Customer $_"; city = "City $_"; status = "ACTIVE"
  }
  if ($c -and $c.data) { $custIds["CUST-$_"] = $c.data.id; Ok "Customer $_" } else { Warn "Customer $_ failed" }
}

# Sales Orders
$M | ForEach-Object {
  $cKey = "CUST-$((($_ - 1) % $M) + 1)"
  $so = Check "POST" "/sales/orders" @{
    soNumber = "SO-$_; customerId = $custIds[$cKey]
    items = @(@{ itemId = $itemIds["ITEM-$_"]; quantity = 50; unitPrice = 25.0; totalPrice = 1250 })
  }
  if ($so) { Ok "Sales Order $_" } else { Warn "Sales Order $_ failed" }
}

# ============ SECTION 6: FINANCE ============
Log "=== FINANCE ===" "Cyan"

# Accounts
$accIds = @{}
$accountTypes = @("ASSET","LIABILITY","EQUITY","INCOME","EXPENSE")
$M | ForEach-Object {
  $at = $accountTypes[($_ - 1) % $accountTypes.Count]
  $a = Check "POST" "/finance/accounts" @{ accountCode = "ACC-$_"; name = "Account $_"; type = $at }
  if ($a -and $a.data) { $accIds["ACC-$_"] = $a.data.id; Ok "Account $_" } else { Warn "Account $_ failed" }
}

# Journal Entries
$M | ForEach-Object {
  $ak1 = "ACC-$_"
  $ak2 = "ACC-$((($_ % $M) + 1))"
  if ($accIds[$ak1] -and $accIds[$ak2]) {
    $je = Check "POST" "/finance/journal-entries" @{
      entryNumber = "JE-$_"; description = "Journal $_"
      items = @(
        @{ accountId = $accIds[$ak1]; debitAmount = 1000; creditAmount = 0; description = "Debit item" }
        @{ accountId = $accIds[$ak2]; debitAmount = 0; creditAmount = 1000; description = "Credit item" }
      )
    }
    if ($je) { Ok "Journal $_" } else { Warn "Journal $_ failed" }
  }
}

# ============ SECTION 7: HR ============
Log "=== HR ===" "Cyan"

# Attendance
$M | ForEach-Object {
  $eKey = "EMP-$((($_ - 1) % $M) + 1)"
  $at = Check "POST" "/hr/attendance" @{
    employeeId = $empIds[$eKey]; date = "2026-07-14"; clockIn = "2026-07-14T08:00:00Z"; clockOut = "2026-07-14T17:00:00Z"; status = "PRESENT"
  }
  if ($at) { Ok "Attendance $_" } else { Warn "Attendance $_ failed" }
}

# Leaves
$M | ForEach-Object {
  $eKey = "EMP-$((($_ - 1) % $M) + 1)"
  $lv = Check "POST" "/hr/leaves" @{
    employeeId = $empIds[$eKey]; leaveType = @("CASUAL","SICK","ANNUAL")[($_ - 1) % 3]
    startDate = "2026-07-20"; endDate = "2026-07-22"; reason = "Leave $_"
  }
  if ($lv) { Ok "Leave $_" } else { Warn "Leave $_ failed" }
}

# Payroll: Payhead, Period, Slips
$M | ForEach-Object {
  $ph = Check "POST" "/hr/payroll/payhead" @{ name = "Payhead $_"; code = "PH-$_"; type = @("EARNING","DEDUCTION","STATUTORY")[($_ - 1) % 3]; amount = 5000 }
  if ($ph) { Ok "Payhead $_" } else { Warn "Payhead $_ failed" }
}
$period = Check "POST" "/hr/payroll/period" @{ name = "July 2026"; startDate = "2026-07-01"; endDate = "2026-07-31" }
if ($period) { $periodId = $period.data.id; Ok "Payroll period created" } else { Warn "Period failed" }

if ($periodId) {
  $M | ForEach-Object {
    $eKey = "EMP-$((($_ - 1) % $M) + 1)"
    $slip = Check "POST" "/hr/payroll/slip" @{
      employeeId = $empIds[$eKey]; periodId = $periodId; basicPay = 50000; totalEarnings = 55000; totalDeductions = 5000; netPay = 50000
    }
    if ($slip) { Ok "PaySlip $_" } else { Warn "PaySlip $_ failed" }
  }
}

# ============ HEAVY LOAD TEST: BULK READS ============
Log "=== HEAVY LOAD TEST ===" "Cyan"
$totalTime = (Get-Date) - $startTime
Log "Seeding completed in $([math]::Round($totalTime.TotalSeconds))s" "Yellow"

Log "Running bulk read tests..." "Yellow"
$readPaths = @(
  "/purchase/vendors?limit=1000"
  "/purchase/demand-notes?limit=1000"
  "/purchase/orders?limit=1000"
  "/purchase/quotations?limit=1000"
  "/purchase/goods-receiving?limit=1000"
  "/sales/customers?limit=1000"
  "/sales/orders?limit=1000"
  "/inventory/items?limit=1000"
  "/inventory/warehouses?limit=1000"
  "/master-data/employee?limit=1000"
  "/master-data/department?limit=1000"
  "/master-data/designation?limit=1000"
  "/master-data/branch?limit=1000"
  "/finance/accounts?limit=1000"
  "/finance/journal-entries?limit=1000"
  "/hr/attendance?limit=1000"
  "/hr/leaves?limit=1000"
  "/hr/payroll/payhead?limit=1000"
  "/hr/payroll/slip?limit=1000"
  "/production/bom?limit=1000"
  "/production/orders?limit=1000"
  "/production/quality?limit=1000"
)

$slowEndpoints = @()
foreach ($path in $readPaths) {
  $t = Get-Date
  $r = Api "GET" $path
  $elapsed = (Get-Date) - $t
  $ms = [math]::Round($elapsed.TotalMilliseconds)
  $count = if ($r -and $r.data) { $r.data.Count } else { 0 }
  $status = if ($r) { "OK" } else { "FAIL" }
  $color = if ($ms -gt 5000) { "Red" } elseif ($ms -gt 2000) { "Yellow" } else { "Green" }
  Log "${status} ${path} → ${count} records in ${ms}ms" $color
  if ($ms -gt 3000) { $slowEndpoints += $path }
}

# ============ RESULTS ============
Log "=== FINAL RESULTS ===" "Cyan"
$totalTime = (Get-Date) - $startTime
Log "Total time: $([math]::Round($totalTime.TotalSeconds))s" "Cyan"

if ($slowEndpoints.Count -gt 0) {
  Warn "Slow endpoints (>3s):"
  $slowEndpoints | ForEach-Object { Warn "  $_" }
} else {
  Ok "All endpoints responded within 3s"
}

# Cleanup
Remove-Item "C:\Users\AAMISH KHAN\Desktop\textuile erp\seed-all.ps1" -Force -ErrorAction SilentlyContinue
Write-Host ""
Log "Seeding complete! Run with: .\seed-all.ps1 -Volume 2 (for higher volume)" "Magenta"
