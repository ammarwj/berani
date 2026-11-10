// Daftar ikon yang benar-benar dipakai. layout.tsx mengirimnya ke Google Fonts
// lewat `icon_names=`, jadi yang terunduh hanya glyph ini — bukan font penuh.
// Tambah nama baru di sini dulu sebelum memakainya, kalau tidak ikonnya kosong.
export const ICON_NAMES = [
  "add",
  "add_photo_alternate",
  "archive",
  "arrow_back",
  "arrow_forward",
  "assignment",
  "attachment",
  "chat_bubble",
  "check",
  "check_circle",
  "chevron_right",
  "close",
  "content_copy",
  "delete",
  "devices",
  "download",
  "edit_note",
  "expand_more",
  "find_in_page",
  "fit_screen",
  "format_align_center",
  "format_align_left",
  "format_align_right",
  "format_image_left",
  "format_image_right",
  "forum",
  "key",
  "front_hand",
  "group_off",
  "groups",
  "help",
  "home",
  "hourglass_top",
  "info",
  "lightbulb",
  "lock",
  "lock_reset",
  "login",
  "logout",
  "manage_accounts",
  "mark_email_read",
  "menu_book",
  "mood",
  "notifications",
  "open_in_new",
  "person_add",
  "phone_in_talk",
  "psychology",
  "quiz",
  "record_voice_over",
  "school",
  "security",
  "settings",
  "shield",
  "shield_person",
  "smart_display",
  "spa",
  "stars",
  "task_alt",
  "verified",
  "verified_user",
  "videocam",
  "visibility",
  "visibility_off",
  "volunteer_activism",
].join(",");

export default function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={`ms ${filled ? "ms-fill" : ""} ${className}`}>
      {name}
    </span>
  );
}
