import { Response, NextFunction } from "express";
import { PathaoLocationService } from "./pathao.service";

export const getPathaoCities = async (req: any, res: Response, next: NextFunction) => {
  try {
    const cities = await PathaoLocationService.getCities();
    res.status(200).json({ status: "success", data: { cities } });
  } catch (error) {
    next(error);
  }
};

export const getPathaoZones = async (req: any, res: Response, next: NextFunction) => {
  try {
    const cityId = parseInt(req.params.cityId, 10);
    if (isNaN(cityId)) {
      return res.status(400).json({ status: "error", message: "Invalid city ID" });
    }
    const zones = await PathaoLocationService.getZones(cityId);
    res.status(200).json({ status: "success", data: { zones } });
  } catch (error) {
    next(error);
  }
};

export const getPathaoAreas = async (req: any, res: Response, next: NextFunction) => {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);
    if (isNaN(zoneId)) {
      return res.status(400).json({ status: "error", message: "Invalid zone ID" });
    }
    const areas = await PathaoLocationService.getAreas(zoneId);
    res.status(200).json({ status: "success", data: { areas } });
  } catch (error) {
    next(error);
  }
};

export const getPathaoStores = async (req: any, res: Response, next: NextFunction) => {
  try {
    const stores = await PathaoLocationService.getStores();
    res.status(200).json({ status: "success", data: { stores } });
  } catch (error) {
    next(error);
  }
};
