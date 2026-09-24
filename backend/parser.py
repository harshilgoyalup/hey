"""
Bank statement transaction parser for StopTheDrip.
Extracts transactions from PDF (via pdfplumber) and CSV (via python csv module) in-memory.
Parses each transaction into: date, description, merchant, amount, txn_type (debit/credit), and status.
Ignores credits when calculating spending. Excludes uncertain rows from totals.
Zero disk storage: all processing is ephemeral in-memory (io.BytesIO).
"""

import csv
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import pdfplumber


DATE_PATTERNS = [
    (r"\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b", ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"]),
    (r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b", ["%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%m-%d-%Y"]),
    (r"\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b", ["%d %b %Y", "%d %B %Y"]),
    (r"\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b", ["%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y"]),
]


def clean_amount(val: Any) -> Optional[float]:
    """
    Parse string representation of monetary amount into float.
    Handles commas, currency symbols (₹, $, €, £), parentheses.
    Returns None if cannot be confidently parsed as a valid positive number.
    """
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None

    # Remove currency symbols and surrounding whitespace
    s = re.sub(r"[₹$€£¥\s]", "", s)
    # Handle parenthesized negative: (123.45) -> -123.45
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]

    # Handle comma/dot decimal formats
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            # European format: 1.234,56
            s = s.replace(".", "").replace(",", ".")
        else:
            # US/UK/Indian format: 1,234.56 or 1,23,456.78
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) == 2:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")

    # Extract number
    match = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    if match:
        try:
            num = float(match.group(0))
            return abs(num)
        except ValueError:
            return None
    return None


def parse_date(date_str: str) -> Optional[str]:
    """
    Normalize arbitrary date string into YYYY-MM-DD.
    Returns None if the date cannot be confidently parsed (no guessing).
    """
    if not date_str:
        return None
    s = date_str.strip()

    for pattern, fmts in DATE_PATTERNS:
        m = re.search(pattern, s)
        if m:
            extracted = m.group(1).replace("/", "-").replace(".", "-")
            for fmt in fmts:
                try:
                    dt = datetime.strptime(extracted, fmt.replace("/", "-").replace(".", "-"))
                    # Sanity check year
                    if 1990 <= dt.year <= 2100:
                        return dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass

    return None


def infer_txn_type(
    desc: str,
    raw_amount_str: str,
    is_in_debit_col: bool = False,
    is_in_credit_col: bool = False,
    type_col_val: Optional[str] = None
) -> str:
    """
    Deterministically determines if a transaction is 'debit', 'credit', or 'uncertain'.
    Credits include deposits, refunds, reversals, and cashbacks.
    """
    # 1. Type column if present (e.g. CR, DR, CREDIT, DEBIT)
    if type_col_val:
        t = type_col_val.strip().upper()
        if t in ("CR", "CREDIT", "DEP", "DEPOSIT", "REFUND"):
            return "credit"
        if t in ("DR", "DEBIT", "WDL", "WITHDRAWAL", "PAYMENT"):
            return "debit"

    # 2. Dedicated column flags
    if is_in_credit_col and not is_in_debit_col:
        return "credit"
    if is_in_debit_col and not is_in_credit_col:
        return "debit"

    # 3. Trailing/leading indicator in amount string (e.g. "500.00 Cr", "+500.00", "-500.00")
    s_amt = raw_amount_str.strip().upper()
    if s_amt.endswith("CR") or s_amt.endswith(" CR") or s_amt.startswith("+"):
        return "credit"
    if s_amt.endswith("DR") or s_amt.endswith(" DR") or s_amt.startswith("-"):
        return "debit"

    # 4. Keyword indicators in description (refunds, reversals, interest, salary)
    desc_upper = desc.upper()
    if any(k in desc_upper for k in ["REFUND", "REVERSAL", "CASHBACK", "SALARY", "INTEREST CREDIT", "DEPOSIT"]):
        return "credit"

    # 5. Default: if in a single amount column without credit indicators, check if parenthesized
    if "(" in raw_amount_str and ")" in raw_amount_str:
        return "credit"

    return "debit"


def parse_csv_content(content_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parse CSV bank statement into normalized transactions.
    Zero disk storage: reads from BytesIO.
    """
    text = ""
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not text:
        raise ValueError("Unable to decode CSV bank statement content.")

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    # Detect delimiter
    sample = "\n".join(lines[:10])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ","

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    all_rows = [row for row in reader if row and any(col.strip() for col in row)]
    if not all_rows:
        return []

    # Find header row
    header_idx = -1
    date_col = -1
    desc_col = -1
    amount_col = -1
    debit_col = -1
    credit_col = -1
    type_col = -1

    for idx, row in enumerate(all_rows[:15]):
        row_lower = [c.strip().lower() for c in row]
        for c_idx, col in enumerate(row_lower):
            if any(k in col for k in ["txn date", "trans date", "value date", "date", "time"]):
                if date_col == -1:
                    date_col = c_idx
            elif any(k in col for k in ["particular", "narrat", "desc", "detail", "merchant", "payee", "memo"]):
                if desc_col == -1:
                    desc_col = c_idx
            elif any(k in col for k in ["withdrawal", "debit", "dr amt", "dr."]):
                debit_col = c_idx
            elif any(k in col for k in ["deposit", "credit", "cr amt", "cr."]):
                credit_col = c_idx
            elif any(k in col for k in ["type", "dr/cr", "cr/dr", "txn type"]):
                type_col = c_idx
            elif any(k in col for k in ["amount", "txn amt", "value", "net"]):
                if amount_col == -1:
                    amount_col = c_idx

        if date_col != -1 and (desc_col != -1 or amount_col != -1 or debit_col != -1):
            header_idx = idx
            break

    transactions: List[Dict[str, Any]] = []
    start_idx = header_idx + 1 if header_idx != -1 else 0
    seen_rows = set()

    for row in all_rows[start_idx:]:
        if len(row) < 2:
            continue

        row_tuple = tuple(c.strip() for c in row)
        if row_tuple in seen_rows:
            # Exclude exact duplicate row
            continue
        seen_rows.add(row_tuple)

        date_val = ""
        desc_val = ""
        raw_amt_str = ""
        amt_val = None
        is_in_debit = False
        is_in_credit = False
        type_str = None

        if header_idx != -1:
            if date_col != -1 and date_col < len(row):
                date_val = row[date_col].strip()
            if desc_col != -1 and desc_col < len(row):
                desc_val = row[desc_col].strip()
            if type_col != -1 and type_col < len(row):
                type_str = row[type_col].strip()

            # Separate debit / credit columns
            if debit_col != -1 and debit_col < len(row) and row[debit_col].strip():
                raw_amt_str = row[debit_col].strip()
                amt_val = clean_amount(raw_amt_str)
                if amt_val is not None and amt_val > 0:
                    is_in_debit = True
            elif credit_col != -1 and credit_col < len(row) and row[credit_col].strip():
                raw_amt_str = row[credit_col].strip()
                amt_val = clean_amount(raw_amt_str)
                if amt_val is not None and amt_val > 0:
                    is_in_credit = True
            elif amount_col != -1 and amount_col < len(row) and row[amount_col].strip():
                raw_amt_str = row[amount_col].strip()
                amt_val = clean_amount(raw_amt_str)
        else:
            # Fallback heuristic across columns
            for col in row:
                col_str = col.strip()
                if not date_val and any(re.search(p[0], col_str) for p in DATE_PATTERNS):
                    date_val = col_str
                elif amt_val is None and clean_amount(col_str) is not None:
                    raw_amt_str = col_str
                    amt_val = clean_amount(col_str)
                elif not desc_val and len(col_str) > 2 and not col_str.replace(".", "").isdigit():
                    desc_val = col_str

        norm_date = parse_date(date_val)
        status = "valid"

        # Check if row is uncertain (missing date, missing/zero amount, or missing description)
        if not norm_date or amt_val is None or amt_val <= 0 or not desc_val:
            status = "uncertain"

        txn_type = infer_txn_type(
            desc=desc_val,
            raw_amount_str=raw_amt_str,
            is_in_debit_col=is_in_debit,
            is_in_credit_col=is_in_credit,
            type_col_val=type_str
        )

        transactions.append({
            "date": norm_date,
            "raw_date": date_val,
            "description": desc_val or "Uncategorized Transaction",
            "merchant": desc_val or "Uncategorized",
            "amount": round(amt_val, 2) if amt_val is not None else 0.0,
            "txn_type": txn_type,
            "status": status
        })

    return transactions


def parse_pdf_content(content_bytes: bytes, password: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Parse PDF bank statement into normalized transactions.
    Zero disk storage: parses directly from in-memory BytesIO.
    Supports multi-page statements and password-protected statements directly in-memory.
    """
    transactions: List[Dict[str, Any]] = []
    seen_rows = set()

    try:
        pdf_kwargs = {}
        if password:
            pdf_kwargs["password"] = password

        with pdfplumber.open(io.BytesIO(content_bytes), **pdf_kwargs) as pdf:
            for page in pdf.pages:
                # 1. Try extracting structured tables first
                tables = page.extract_tables()
                table_found_txns = False

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    # Check headers
                    date_col = -1
                    desc_col = -1
                    amt_col = -1
                    debit_col = -1
                    credit_col = -1
                    type_col = -1

                    for c_idx, cell in enumerate(table[0]):
                        if not cell:
                            continue
                        cl = str(cell).lower()
                        if any(k in cl for k in ["txn date", "trans date", "date"]):
                            date_col = c_idx
                        elif any(k in cl for k in ["desc", "particular", "narrat", "detail", "merchant"]):
                            desc_col = c_idx
                        elif any(k in cl for k in ["withdrawal", "debit", "dr"]):
                            debit_col = c_idx
                        elif any(k in cl for k in ["deposit", "credit", "cr"]):
                            credit_col = c_idx
                        elif any(k in cl for k in ["type", "dr/cr"]):
                            type_col = c_idx
                        elif any(k in cl for k in ["amount", "amt", "total"]):
                            amt_col = c_idx

                    for row in table[1:]:
                        if not row or len(row) < 2:
                            continue

                        row_strs = [str(c or "").strip() for c in row]
                        d_val = ""
                        desc_val = ""
                        raw_amt = ""
                        amt_val = None
                        is_in_debit = False
                        is_in_credit = False
                        type_str = None

                        if date_col != -1 and date_col < len(row_strs):
                            d_val = row_strs[date_col]
                        if desc_col != -1 and desc_col < len(row_strs):
                            desc_val = row_strs[desc_col]
                        if type_col != -1 and type_col < len(row_strs):
                            type_str = row_strs[type_col]

                        if debit_col != -1 and debit_col < len(row_strs) and row_strs[debit_col]:
                            raw_amt = row_strs[debit_col]
                            amt_val = clean_amount(raw_amt)
                            if amt_val is not None and amt_val > 0:
                                is_in_debit = True
                        elif credit_col != -1 and credit_col < len(row_strs) and row_strs[credit_col]:
                            raw_amt = row_strs[credit_col]
                            amt_val = clean_amount(raw_amt)
                            if amt_val is not None and amt_val > 0:
                                is_in_credit = True
                        elif amt_col != -1 and amt_col < len(row_strs) and row_strs[amt_col]:
                            raw_amt = row_strs[amt_col]
                            amt_val = clean_amount(raw_amt)

                        # Fallback across cells if columns not cleanly mapped
                        if amt_val is None:
                            for cell in row_strs:
                                c_amt = clean_amount(cell)
                                if c_amt is not None and c_amt > 0:
                                    raw_amt = cell
                                    amt_val = c_amt
                                    break

                        if not d_val:
                            for cell in row_strs:
                                if any(re.search(p[0], cell) for p in DATE_PATTERNS):
                                    d_val = cell
                                    break

                        if not desc_val:
                            for cell in row_strs:
                                if len(cell) > 3 and clean_amount(cell) is None and cell != d_val:
                                    desc_val = cell
                                    break

                        row_key = (d_val, desc_val, raw_amt)
                        if row_key in seen_rows:
                            continue
                        seen_rows.add(row_key)

                        norm_date = parse_date(d_val)
                        status = "valid"
                        if not norm_date or amt_val is None or amt_val <= 0 or not desc_val:
                            status = "uncertain"

                        txn_type = infer_txn_type(
                            desc=desc_val,
                            raw_amount_str=raw_amt,
                            is_in_debit_col=is_in_debit,
                            is_in_credit_col=is_in_credit,
                            type_col_val=type_str
                        )

                        if amt_val is not None and amt_val > 0:
                            transactions.append({
                                "date": norm_date,
                                "raw_date": d_val,
                                "description": desc_val or "Card Transaction",
                                "merchant": desc_val or "Card Transaction",
                                "amount": round(amt_val, 2),
                                "txn_type": txn_type,
                                "status": status
                            })
                            table_found_txns = True

                # 2. If table extraction yielded nothing on this page, parse raw lines
                if not table_found_txns:
                    text = page.extract_text() or ""
                    for line in text.splitlines():
                        line = line.strip()
                        if not line:
                            continue

                        amt_match = re.findall(r"(?:₹|\$|€|£)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))", line)
                        date_match = None
                        for pattern, _ in DATE_PATTERNS:
                            m = re.search(pattern, line)
                            if m:
                                date_match = m.group(1)
                                break

                        if amt_match and date_match:
                            raw_amt_str = amt_match[0]
                            amt = clean_amount(raw_amt_str)
                            if amt and amt > 0:
                                desc = line.replace(date_match, "").replace(raw_amt_str, "").strip()
                                desc = re.sub(r"^[^\w]+|[^\w]+$", "", desc)

                                line_key = (date_match, desc, raw_amt_str)
                                if line_key in seen_rows:
                                    continue
                                seen_rows.add(line_key)

                                norm_date = parse_date(date_match)
                                status = "valid" if norm_date and desc else "uncertain"
                                txn_type = infer_txn_type(desc=desc, raw_amount_str=raw_amt_str)

                                transactions.append({
                                    "date": norm_date,
                                    "raw_date": date_match,
                                    "description": desc or "Card Payment",
                                    "merchant": desc or "Card Payment",
                                    "amount": round(amt, 2),
                                    "txn_type": txn_type,
                                    "status": status
                                })
    except Exception as exc:
        err_msg = str(exc).lower()
        if "password" in err_msg or "encrypt" in err_msg or "unsupported encryption" in err_msg:
            if password:
                raise ValueError("PASSWORD_INCORRECT: The password provided for this PDF statement was incorrect. Please verify and try again.")
            else:
                raise ValueError("PASSWORD_REQUIRED: This PDF bank statement is password-protected. Please enter your statement password directly on the page to unlock.")
        raise

    return transactions


def parse_statement(filename: str, content_bytes: bytes, password: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Dispatcher to parse PDF or CSV bank statement based on filename/content with optional password.
    """
    fname = filename.lower()
    if fname.endswith(".pdf") or content_bytes.startswith(b"%PDF"):
        return parse_pdf_content(content_bytes, password=password)
    elif fname.endswith(".csv") or fname.endswith(".txt"):
        return parse_csv_content(content_bytes)
    else:
        if content_bytes.startswith(b"%PDF"):
            return parse_pdf_content(content_bytes, password=password)
        return parse_csv_content(content_bytes)
