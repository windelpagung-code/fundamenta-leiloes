export type PaymentMethod = 'CASH' | 'FINANCING';

// ── Extended calculator types ────────────────────────────────────────────────

export interface ExtendedCalculatorInput {
  bidValue: number;
  marketValue: number;
  areaTotal?: number;
  paymentMethod: PaymentMethod;
  downPaymentPercentage: number;
  financingTermMonths: number;
  financingInterestRate: number;
  auctioneerFeePercentage: number;
  documentationCosts: number;
  evictionCosts: number;
  renovationBudget: number;
  // Sale
  salePrice: number;
  sellingCommission: number;    // % imobiliária na venda
  capitalGainsTax: number;     // % IR sobre ganho de capital
  // Holding
  monthlyIPTU: number;
  monthlyCondominium: number;
  holdingPeriodMonths: number;
  // Rental
  expectedMonthlyRent: number;
}

export interface ExtendedCalculatorResult {
  auctioneerFee: number;
  totalAcquisitionCost: number;
  holdingCosts: number;
  sellingCommissionCost: number;
  capitalGain: number;
  capitalGainsTaxAmount: number;
  netProfitSale: number;
  roiSale: number;
  monthlyNetRent: number;
  annualRentalYield: number;
  monthlyPayment?: number;
  // Legacy compat
  totalCosts: number;
  totalOperationCost: number;
  estimatedNetProfit: number;
  estimatedROI: number;
  estimatedMarketValuePostRenovation: number;
}

export interface CalcScenario {
  id: string;
  name: string;
  propertyId: string;
  input: ExtendedCalculatorInput;
  result: ExtendedCalculatorResult;
  savedAt: string;
}

export function calculateExtended(input: ExtendedCalculatorInput): ExtendedCalculatorResult {
  const auctioneerFee = input.bidValue * (input.auctioneerFeePercentage / 100);
  const totalAcquisitionCost =
    input.bidValue + auctioneerFee + input.documentationCosts +
    input.evictionCosts + input.renovationBudget;

  const holdingCosts = (input.monthlyIPTU + input.monthlyCondominium) * input.holdingPeriodMonths;
  const sellingCommissionCost = input.salePrice * (input.sellingCommission / 100);
  const capitalGain = input.salePrice - totalAcquisitionCost;
  const capitalGainsTaxAmount = Math.max(0, capitalGain) * (input.capitalGainsTax / 100);
  const netProfitSale =
    input.salePrice - totalAcquisitionCost - holdingCosts -
    sellingCommissionCost - capitalGainsTaxAmount;
  const roiSale = totalAcquisitionCost > 0 ? (netProfitSale / totalAcquisitionCost) * 100 : 0;

  const monthlyNetRent = input.expectedMonthlyRent - input.monthlyIPTU - input.monthlyCondominium;
  const annualRentalYield =
    totalAcquisitionCost > 0 ? (monthlyNetRent * 12 / totalAcquisitionCost) * 100 : 0;

  let monthlyPayment: number | undefined;
  if (input.paymentMethod === 'FINANCING' && input.financingTermMonths > 0) {
    const principal = input.bidValue * (1 - input.downPaymentPercentage / 100);
    const r = input.financingInterestRate / 100;
    monthlyPayment = r > 0
      ? (principal * r * Math.pow(1 + r, input.financingTermMonths)) /
        (Math.pow(1 + r, input.financingTermMonths) - 1)
      : principal / input.financingTermMonths;
  }

  const totalCosts = auctioneerFee + input.documentationCosts + input.evictionCosts + input.renovationBudget;

  return {
    auctioneerFee,
    totalAcquisitionCost,
    holdingCosts,
    sellingCommissionCost,
    capitalGain,
    capitalGainsTaxAmount,
    netProfitSale,
    roiSale,
    monthlyNetRent,
    annualRentalYield,
    monthlyPayment,
    totalCosts,
    totalOperationCost: totalAcquisitionCost,
    estimatedNetProfit: netProfitSale,
    estimatedROI: roiSale,
    estimatedMarketValuePostRenovation: input.salePrice,
  };
}

// ── Legacy types below ───────────────────────────────────────────────────────

export interface FinancialAnalysis {
  id: string;
  userId: string;
  propertyId: string;
  bidValue: number;
  paymentMethod: PaymentMethod;
  downPaymentPercentage?: number;
  financingTermMonths?: number;
  financingInterestRate?: number;
  auctioneerFeePercentage: number;
  documentationCosts: number;
  evictionCosts: number;
  renovationBudget: number;
  totalOperationCost: number;
  estimatedROI: number;
  estimatedNetProfit: number;
  marketPricePerSqMeter?: number;
  potentialAppreciation?: number;
  aiAnalysis?: AIAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysisResult {
  occupationStatus: string;
  legalRisks: string[];
  legalSummary: string;
  marketAnalysis: string;
  recommendation: string;
  estimatedMarketValue?: number;
  estimatedEvictionCosts?: number;
}

export interface FinancialCalculatorInput {
  bidValue: number;
  marketValue: number;
  areaTotal?: number;
  paymentMethod: PaymentMethod;
  downPaymentPercentage: number;
  financingTermMonths: number;
  financingInterestRate: number;
  auctioneerFeePercentage: number;
  documentationCosts: number;
  evictionCosts: number;
  renovationBudget: number;
}

export interface FinancialCalculatorResult {
  auctioneerFee: number;
  totalCosts: number;
  totalOperationCost: number;
  estimatedMarketValuePostRenovation: number;
  estimatedNetProfit: number;
  estimatedROI: number;
  monthlyPayment?: number;
  cashFlow?: number[];
}

export function calculateFinancials(input: FinancialCalculatorInput): FinancialCalculatorResult {
  const auctioneerFee = input.bidValue * (input.auctioneerFeePercentage / 100);
  const totalCosts = auctioneerFee + input.documentationCosts + input.evictionCosts + input.renovationBudget;
  const totalOperationCost = input.bidValue + totalCosts;

  const estimatedMarketValuePostRenovation = input.marketValue * 1.1;
  const estimatedNetProfit = estimatedMarketValuePostRenovation - totalOperationCost;
  const estimatedROI = (estimatedNetProfit / totalOperationCost) * 100;

  let monthlyPayment: number | undefined;
  if (input.paymentMethod === 'FINANCING' && input.financingTermMonths > 0) {
    const principal = input.bidValue * (1 - input.downPaymentPercentage / 100);
    const monthlyRate = input.financingInterestRate / 100 / 12;
    if (monthlyRate > 0) {
      monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, input.financingTermMonths))
        / (Math.pow(1 + monthlyRate, input.financingTermMonths) - 1);
    } else {
      monthlyPayment = principal / input.financingTermMonths;
    }
  }

  return {
    auctioneerFee,
    totalCosts,
    totalOperationCost,
    estimatedMarketValuePostRenovation,
    estimatedNetProfit,
    estimatedROI,
    monthlyPayment,
  };
}
