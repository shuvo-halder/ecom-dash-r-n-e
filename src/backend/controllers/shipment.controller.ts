import { Response, NextFunction } from "express";
import { AdminShipmentService } from "../services/shipment.service";

export const createShipment = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { orderId, courierId, trackingNumber, items } = req.body;
    const shipment = await AdminShipmentService.createShipment(orderId, courierId, trackingNumber, items);
    res.status(201).json({ status: "success", data: { shipment } });
  } catch (error) {
    next(error);
  }
};

export const getShipments = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await AdminShipmentService.getShipments({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      status: status as string
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const getShipmentById = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shipment = await AdminShipmentService.getShipmentById(id);
    res.status(200).json({ status: "success", data: { shipment } });
  } catch (error) {
    next(error);
  }
};

export const updateShipmentStatus = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, location, description, trackingNumber, courier, courierId } = req.body;
    const shipment = await AdminShipmentService.updateShipmentStatus(
      id,
      status,
      location,
      description,
      trackingNumber,
      courier,
      courierId
    );
    res.status(200).json({ status: "success", data: { shipment } });
  } catch (error) {
    next(error);
  }
};

export const deleteShipment = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await AdminShipmentService.deleteShipment(id);
    res.status(200).json({
      status: "success",
      message: "Shipment archived successfully"
    });
  } catch (error) {
    next(error);
  }
};
