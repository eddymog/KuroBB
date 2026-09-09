import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("forums", "routes/forums.tsx"),
  route("forums/new", "routes/forums.new.tsx"),
  route("forums/:forumId", "routes/forums.$forumId.tsx"),
  route("forums/:forumId/new", "routes/forums.$forumId.new.tsx"),
  route("threads/:threadId", "routes/threads.$threadId.tsx"),
  route("posts/:postId/edit", "routes/posts.$postId.edit.tsx"),
  route("auth/register", "routes/auth.register.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("users/:userId", "routes/users.$userId.tsx"),
  route("settings", "routes/settings.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/forums", "routes/admin.forums.tsx"),
  route("admin/forums/:forumId/edit", "routes/admin.forums.$forumId.edit.tsx"),
  route("admin/groups", "routes/admin.groups.tsx"),
  route("admin/groups/:groupId", "routes/admin.groups.$groupId.tsx"),
] satisfies RouteConfig;
