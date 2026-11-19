"use client";
import { ScannerScreen } from "@/components/scanner/ScannerScreen";

export function LensScanView() {
  return <ScannerScreen mode="lens" initialFacing="environment" />;
}
