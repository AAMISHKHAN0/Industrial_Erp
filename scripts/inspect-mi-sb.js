const fs = require('fs');
const schema = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');

for (const m of ['MaterialIssue', 'MaterialIssueItem', 'SupplierBill', 'SupplierBillItem']) {
  const match = schema.match(new RegExp('model ' + m + ' \\\\{[\\\\s\\\\S]*?\\\\n\\\\}', 'm'));
  if (match) {
    console.log(match[0]);
  }
}
