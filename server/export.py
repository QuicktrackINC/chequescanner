import xlsxwriter
from sqlalchemy.orm import Session
from io import BytesIO
from .models import Check, CheckBatch

def generate_accounting_spreadsheet(db: Session, batch_id: int) -> BytesIO:
    """
    Generates accurately formatted PRD 3 Accounting Spreadsheet.
    """
    checks = db.query(Check).filter(Check.batch_id == batch_id).all()
    batch_number = db.query(CheckBatch).filter(CheckBatch.id <= batch_id).count()
    
    import pytz
    texas_tz = pytz.timezone('US/Central')

    data = []
    for check in checks:
        formatted_amount = f"${check.amount:,.2f}" if check.amount is not None else "$0.00"
        formatted_date = check.check_date.strftime("%Y-%m-%d") if check.check_date else "N/A"
        
        if check.reviewed_at:
            # SQLAlchemy returns naive datetime objects (assumed UTC from DB)
            utc_dt = check.reviewed_at.replace(tzinfo=pytz.UTC)
            texas_dt = utc_dt.astimezone(texas_tz)
            formatted_reviewed_at = texas_dt.strftime("%Y-%m-%d %I:%M:%S %p CT")
        else:
            formatted_reviewed_at = "N/A"

        data.append({
            "Batch Number": batch_number,
            "Date": formatted_date,
            "Store": check.store_name or "N/A",
            "Payee": check.payee or "N/A",
            "Amount": formatted_amount,
            "Bank Name": check.bank or "N/A",
            "Routing Number": check.routing_number or "N/A",
            "Account Number": check.account_number or "N/A",
            "Check Number": check.check_number or "N/A",
            "Memo": check.memo or "N/A",
            "Status": check.status.value,
            "Reviewed By": check.reviewed_by or "Auto",
            "Reviewed At": formatted_reviewed_at
        })
        
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet(f"Batch_{batch_number}")
    
    if data:
        headers = list(data[0].keys())
        # Write headers
        for col_num, header in enumerate(headers):
            worksheet.write(0, col_num, header)
            
        # Write data and compute max column widths
        col_widths = {i: len(header) for i, header in enumerate(headers)}
        for row_num, row_data in enumerate(data):
            for col_num, key in enumerate(headers):
                cell_value = str(row_data[key])
                worksheet.write(row_num + 1, col_num, cell_value)
                col_widths[col_num] = max(col_widths[col_num], len(cell_value))
                
        # Set column widths
        for col_num, width in col_widths.items():
            worksheet.set_column(col_num, col_num, width + 2)
            
    workbook.close()
    output.seek(0)
    return output
