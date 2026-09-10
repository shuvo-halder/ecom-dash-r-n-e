import { Response, NextFunction } from "express";
import { SettingService } from "../services/setting.service";
import { AuthRequest } from "../middlewares/auth";

export const getGeneral = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getGeneral();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateGeneral = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateGeneral(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getBranding = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getBranding();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateBranding = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateBranding(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getSEO = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getSEO();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateSEO = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateSEO(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getSMTP = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getSMTP();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateSMTP = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateSMTP(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getAnalytics();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateAnalytics(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getSecurity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getSecurity();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateSecurity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateSecurity(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getShipping = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getShipping();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateShipping = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateShipping(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getTax = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getTax();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateTax = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateTax(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const getStore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.getStore();
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};

export const updateStore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await SettingService.updateStore(req.body, req.user!.id);
    res.status(200).json({ status: "success", data: result });
  } catch (error) { next(error); }
};
