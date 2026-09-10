import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ArchiveService } from "../services/archive.service";
import { HardDeleteService } from "../services/hard-delete.service";
import { SupportedArchiveEntityType } from "../validators/archive.validator";
import { AuthRequest } from "../middlewares/auth";

export const listArchived = asyncHandler(async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as SupportedArchiveEntityType;
  const result = await ArchiveService.listArchived(entityType, req.query);

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const restoreEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as SupportedArchiveEntityType;
  const { id } = req.params;
  const actorUserId = req.user?.id || null;

  const restored = await ArchiveService.restoreEntity(entityType, id, actorUserId, req);

  res.status(200).json({
    success: true,
    message: `${entityType} restored successfully`,
    data: restored,
  });
});

export const checkHardDeleteSafety = asyncHandler(async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as SupportedArchiveEntityType;
  const { id } = req.params;
  const actorUserId = req.user?.id || null;

  const checkResult = await HardDeleteService.checkHardDeleteSafety(entityType, id, actorUserId);

  res.status(200).json({
    success: true,
    data: checkResult,
  });
});

export const hardDeleteEntity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as SupportedArchiveEntityType;
  const { id } = req.params;
  const { reason } = req.body;
  const actorUserId = req.user?.id || null;

  const result = await HardDeleteService.hardDeleteEntity(entityType, id, reason, actorUserId, req);

  res.status(200).json({
    success: true,
    message: `${entityType} hard deleted permanently`,
    data: result,
  });
});
