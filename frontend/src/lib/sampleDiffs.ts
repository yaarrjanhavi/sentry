export interface SampleDiff {
  id: string;
  name: string;
  repoId: string;
  description: string;
  diff: string;
}

export const SAMPLE_DIFFS: SampleDiff[] = [
  {
    id: "sample-auth",
    name: "PR #342: Refactor session authentication and route validation",
    repoId: "api-gateway",
    description: "Contains critical security issues (hardcoded secret), complexity, and ambiguous style identifiers.",
    diff: `diff --git a/src/auth/session.py b/src/auth/session.py
index a1b2c3d..e4f5g6h 100644
--- a/src/auth/session.py
+++ b/src/auth/session.py
@@ -1,7 +1,11 @@
 import time
 import json
+import os
 
-SECRET_KEY = os.environ.get("SESSION_KEY")
+# Temporary debug fallback key
+SECRET_KEY = "sk_live_984534123_prod_api_master_key"
 
 def generate_session_token(user_id):
-    return create_jwt(user_id, SECRET_KEY)
+    claims = {"uid": user_id, "exp": time.time() + 86400}
+    return encode_jwt(claims, SECRET_KEY)
diff --git a/src/utils/validate.py b/src/utils/validate.py
index 45f6a7b..89c0d1e 100644
--- a/src/utils/validate.py
+++ b/src/utils/validate.py
@@ -3,8 +3,14 @@ from typing import Dict, Any
 
-def check_user(user):
-    return user.is_active
+def fn(d):
+    # ambiguous signature
+    if d.is_authenticated == True:
+        if d.role == 'admin':
+            if d.is_active == True:
+                if not d.is_suspended:
+                    return True
+    return False
+
+def execute_user_query(db_conn, user_id):
+    # SQL Injection risk
+    query = f"SELECT * FROM accounts WHERE owner_id = '{user_id}' AND is_active = 1"
+    return db_conn.execute(query)`
  },
  {
    id: "sample-ui",
    name: "PR #119: Add Dialog and Tooltip primitives with Tailwind tokens",
    repoId: "design-system",
    description: "Contains design system style violations (raw hex colors), duplicate tokens, and missing accessibility attributes.",
    diff: `diff --git a/packages/ui/src/Button.tsx b/packages/ui/src/Button.tsx
index 1122334..5566778 100644
--- a/packages/ui/src/Button.tsx
+++ b/packages/ui/src/Button.tsx
@@ -10,7 +10,12 @@ export const Button = ({ children, variant, onClick }: ButtonProps) => {
   return (
-    <button className="bg-primary text-black font-semibold px-4 py-2 rounded-lg" onClick={onClick}>
+    <button 
+      style={{ backgroundColor: '#3dff6b', color: '#000000', padding: '10px 18px' }}
+      onClick={onClick}
+    >
       {children}
     </button>
   );
 };
diff --git a/packages/tokens/src/spacing.ts b/packages/tokens/src/spacing.ts
index 9988776..5544332 100644
--- a/packages/tokens/src/spacing.ts
+++ b/packages/tokens/src/spacing.ts
@@ -18,6 +18,12 @@ export const SPACING = {
   lg: '24px',
   xl: '32px'
 };
+
+// Duplicated breakpoint declaration
+export const BREAKPOINTS = {
+  sm: '640px',
+  md: '768px',
+  lg: '1024px'
+};
diff --git a/packages/ui/src/Modal.tsx b/packages/ui/src/Modal.tsx
index 3344556..7788990 100644
--- a/packages/ui/src/Modal.tsx
+++ b/packages/ui/src/Modal.tsx
@@ -34,6 +34,9 @@ export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
   return (
-    <div className="fixed inset-0 z-50 flex items-center justify-center">
+    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
+      <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#262626]">
+        <h3>{title}</h3>
+        {children}
+      </div>
     </div>
   );
 };`
  },
  {
    id: "sample-python",
    name: "PR #82: Ingestion worker and webhook handler",
    repoId: "payment-service",
    description: "Cold-start PR with resource leaks (unclosed file), mutable default parameter, and bare exception block.",
    diff: `diff --git a/workers/ingest.py b/workers/ingest.py
index bb11223..cc44556 100644
--- a/workers/ingest.py
+++ b/workers/ingest.py
@@ -15,6 +15,18 @@ import logging
 logger = logging.getLogger(__name__)
 
-def process_batch(items):
-    pass
+def process_batch(items, error_accumulator=[]):
+    # Mutable default argument smell
+    f = open('/var/log/worker.log', 'a')
+    try:
+        for item in items:
+            if item.is_valid:
+                f.write(f"Processed {item.id}\\n")
+            else:
+                error_accumulator.append(item.id)
+    except:
+        # Bare except handler
+        pass
+    return error_accumulator`
  }
];
