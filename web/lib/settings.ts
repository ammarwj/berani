export type Category = { value: string; icon: string; label: string; desc: string };

// bk_name/bk_phone hanya ikut untuk permintaan yang membawa token — server yang
// memutuskannya, jadi keduanya opsional di sini.
export type Settings = {
  school_name: string;
  hotline_label: string;
  hotline_phone: string;
  anonymous_enabled: boolean;
  report_categories: Category[];
  bk_name?: string;
  bk_phone?: string;
};
