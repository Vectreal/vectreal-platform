ALTER TABLE "scene_settings" ADD COLUMN "bounds" json;--> statement-breakpoint
ALTER TABLE "scene_settings" ADD COLUMN "camera" json;--> statement-breakpoint
ALTER TABLE "scene_settings" DROP COLUMN "meta";