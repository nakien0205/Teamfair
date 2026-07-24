import { describe, expect, it } from "vitest";
import { buildVietQrQuickLink } from "../../supabase/functions/_shared/vietqr.ts";

const validInput = {
  bankId: "970415",
  accountNumber: "113366668888",
  amount: 79_000,
  transferReference: "TFABC1234567890",
  accountName: "TEAMFAIR EDUCATION",
};

describe("buildVietQrQuickLink", () => {
  it("builds the current VietQR Quick Link syntax with encoded query values", () => {
    expect(buildVietQrQuickLink(validInput)).toBe(
      "https://img.vietqr.io/image/970415-113366668888-qr_only.png" +
        "?amount=79000&addInfo=TFABC1234567890&accountName=TEAMFAIR%20EDUCATION",
    );
  });

  it("percent-encodes reserved and Unicode account-name characters", () => {
    expect(
      buildVietQrQuickLink({
        ...validInput,
        bankId: "ICB",
        accountName: "TEAMFAIR & ĐẠI HỌC",
      }),
    ).toBe(
      "https://img.vietqr.io/image/ICB-113366668888-qr_only.png" +
        "?amount=79000&addInfo=TFABC1234567890" +
        "&accountName=TEAMFAIR%20%26%20%C4%90%E1%BA%A0I%20H%E1%BB%8CC",
    );
  });

  it("accepts documented maximum account, amount, and reference boundaries", () => {
    const accountNumber = "1234567890123456789";
    const transferReference = "A".repeat(50);

    expect(
      buildVietQrQuickLink({
        ...validInput,
        accountNumber,
        amount: 9_999_999_999_999,
        transferReference,
      }),
    ).toBe(
      `https://img.vietqr.io/image/970415-${accountNumber}-qr_only.png` +
        `?amount=9999999999999&addInfo=${transferReference}` +
        "&accountName=TEAMFAIR%20EDUCATION",
    );
  });

  it.each(["", "970415/other", "970415?amount=1", "vietin-bank"])(
    "rejects an unsafe bank identifier: %s",
    (bankId) => {
      expect(() => buildVietQrQuickLink({ ...validInput, bankId })).toThrow(
        "Invalid VietQR bank identifier.",
      );
    },
  );

  it.each(["", "1234-5678", "12345678901234567890"])(
    "rejects an invalid account number: %s",
    (accountNumber) => {
      expect(() => buildVietQrQuickLink({ ...validInput, accountNumber })).toThrow(
        "Invalid VietQR account number.",
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 10_000_000_000_000])(
    "rejects an invalid transfer amount: %s",
    (amount) => {
      expect(() => buildVietQrQuickLink({ ...validInput, amount })).toThrow(
        "Invalid VietQR amount.",
      );
    },
  );

  it.each(["", "TF/ABC", "TF&AMOUNT=1", "A".repeat(51)])(
    "rejects an invalid transfer reference: %s",
    (transferReference) => {
      expect(() => buildVietQrQuickLink({ ...validInput, transferReference })).toThrow(
        "Invalid VietQR transfer reference.",
      );
    },
  );

  it.each(["", "   "])("rejects a blank account name", (accountName) => {
    expect(() => buildVietQrQuickLink({ ...validInput, accountName })).toThrow(
      "Invalid VietQR account name.",
    );
  });
});
