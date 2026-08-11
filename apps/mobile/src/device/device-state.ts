import * as Battery from 'expo-battery';
import { Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  batteryCheck,
  networkCheck,
  orientationCheck,
  storageCheck,
  type DeviceCheck,
} from './device-readiness';

export async function readNonPermissionDeviceChecks(): Promise<DeviceCheck[]> {
  const [power, network, orientation] = await Promise.all([
    Battery.getPowerStateAsync(),
    Network.getNetworkStateAsync(),
    ScreenOrientation.getOrientationAsync(),
  ]);

  const charging =
    power.batteryState === Battery.BatteryState.CHARGING ||
    power.batteryState === Battery.BatteryState.FULL;

  return [
    storageCheck(Paths.availableDiskSpace),
    batteryCheck(power.batteryLevel, charging, power.lowPowerMode),
    orientationCheck(orientation === ScreenOrientation.Orientation.PORTRAIT_UP),
    networkCheck(network.isConnected === true, network.isInternetReachable ?? null),
  ];
}
