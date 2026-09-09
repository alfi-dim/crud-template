import { type RouteConfig, index, prefix, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/_protected/layout/index.tsx", [route("/home", "routes/_protected/home.tsx")]),
  ...prefix("auth", [index("routes/auth/login.tsx"), route("/logout", "routes/auth/logout.tsx")]),
] satisfies RouteConfig;
