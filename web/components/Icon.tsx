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
  "devices",
  "edit_note",
  "find_in_page",
  "forum",
  "key",
  "front_hand",
  "group_off",
  "groups",
  "home",
  "hourglass_top",
  "info",
  "lightbulb",
  "lock",
  "lock_reset",
  "logout",
  "manage_accounts",
  "mark_email_read",
  "menu_book",
  "mood",
  "notifications",
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
