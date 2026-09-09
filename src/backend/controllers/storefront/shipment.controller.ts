import { Request, Response, NextFunction } from "express";
import { CustomerAuthRequest } from "../../middlewares/customerAuth";
import { StorefrontShipmentService } from "../../services/storefront/shipment.service";

export const getMyShipments = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const customerId = req.customer!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const status = req.query.status as string | undefined;

    const result = await StorefrontShipmentService.getCustomerShipments(customerId, {
      page,
      limit,
      status,
    });

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderShipments = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const customerId = req.customer!.id;
    const orderId = req.params.orderId || req.params.id;

    const result = await StorefrontShipmentService.getOrderShipments(customerId, orderId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getShipmentById = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const customerId = req.customer!.id;
    const shipmentId = req.params.shipmentId || req.params.id;

    const result = await StorefrontShipmentService.getShipmentById(customerId, shipmentId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderTracking = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const customerId = req.customer!.id;
    const orderId = req.params.orderId || req.params.id;

    const result = await StorefrontShipmentService.getOrderTracking(customerId, orderId);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const trackGuestOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderNumber =
      (req.body.orderNumber as string) ||
      (req.query.orderNumber as string) ||
      (req.params.orderNumber as string);

    const phoneOrEmail =
      (req.body.phoneOrEmail as string) ||
      (req.body.email as string) ||
      (req.body.phone as string) ||
      (req.query.phoneOrEmail as string) ||
      (req.query.email as string) ||
      (req.query.phone as string);

    const result = await StorefrontShipmentService.getGuestOrderTracking(
      orderNumber,
      phoneOrEmail
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
