export type VietQrQuickLinkInput = {
  bankId: string;
  accountNumber: string;
  amount: number;
  transferReference: string;
  accountName: string;
};

const SAFE_BANK_ID = /^[A-Za-z0-9]+$/;
const ACCOUNT_NUMBER = /^[A-Za-z0-9]{1,19}$/;
const TRANSFER_REFERENCE = /^[A-Za-z0-9]{1,50}$/;
const MAX_AMOUNT = 9_999_999_999_999;

export function buildVietQrQuickLink(input: VietQrQuickLinkInput): string {
  if (typeof input.bankId !== "string" || !SAFE_BANK_ID.test(input.bankId)) {
    throw new Error("Invalid VietQR bank identifier.");
  }
  if (
    typeof input.accountNumber !== "string" ||
    !ACCOUNT_NUMBER.test(input.accountNumber)
  ) {
    throw new Error("Invalid VietQR account number.");
  }
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > MAX_AMOUNT
  ) {
    throw new Error("Invalid VietQR amount.");
  }
  if (
    typeof input.transferReference !== "string" ||
    !TRANSFER_REFERENCE.test(input.transferReference)
  ) {
    throw new Error("Invalid VietQR transfer reference.");
  }
  if (typeof input.accountName !== "string" || !input.accountName.trim()) {
    throw new Error("Invalid VietQR account name.");
  }

  return (
    "https://img.vietqr.io/image/" +
    `${encodeURIComponent(input.bankId)}-` +
    `${encodeURIComponent(input.accountNumber)}-qr_only.png` +
    `?amount=${encodeURIComponent(String(input.amount))}` +
    `&addInfo=${encodeURIComponent(input.transferReference)}` +
    `&accountName=${encodeURIComponent(input.accountName)}`
  );
}
