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

import { PathaoDeliveryService } from "./pathao-delivery.service";

export const createPathaoDelivery = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const {
      store_id,
      recipient_city,
      recipient_zone,
      recipient_area,
      recipient_address,
      recipient_name,
      recipient_phone,
      cod_amount,
      item_weight,
      special_instruction,
    } = req.body;

    if (!store_id || !recipient_city || !recipient_zone || !recipient_area || !recipient_address) {
      return res.status(400).json({
        status: "error",
        message: "Missing required delivery fields (store_id, recipient_city, recipient_zone, recipient_area, recipient_address)",
      });
    }

    const shipment = await PathaoDeliveryService.createDelivery(orderId, {
      store_id: Number(store_id),
      recipient_city: Number(recipient_city),
      recipient_zone: Number(recipient_zone),
      recipient_area: Number(recipient_area),
      recipient_address,
      recipient_name,
      recipient_phone,
      cod_amount: cod_amount !== undefined ? Number(cod_amount) : undefined,
      item_weight: item_weight ? Number(item_weight) : undefined,
      special_instruction,
    });

    res.status(201).json({ status: "success", data: { shipment } });
  } catch (error) {
    next(error);
  }
};
