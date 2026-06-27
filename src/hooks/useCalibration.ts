import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  makeCalibration,
  VENUE_GPS_ANCHORS,
  type GpsAnchor,
  type GpsCalibration,
} from '../lib/gps';

export type UseCalibration = {
  anchors: GpsAnchor[];
  calibration: GpsCalibration;
  loading: boolean;
  saveAnchors: (anchors: GpsAnchor[]) => Promise<null>;
};

// 全场 GPS 标定：优先用服务器存的锚点，没有则退回代码里 baked 的占位锚点。
export function useCalibration(): UseCalibration {
  const remote = useQuery(api.gpsCalibration.getCalibration);
  const save = useMutation(api.gpsCalibration.saveCalibration);

  const anchors: GpsAnchor[] = remote && remote.length > 0 ? remote : VENUE_GPS_ANCHORS;
  const calibration = useMemo(() => makeCalibration(anchors), [anchors]);

  return {
    anchors,
    calibration,
    loading: remote === undefined,
    saveAnchors: (next) => save({ anchors: next }),
  };
}
