// "use client";

// import { useEffect, useState } from "react";

// export default function Home() {
//   const [status, setStatus] = useState("checking...");

//   useEffect(() => {
//     fetch("http://127.0.0.1:8000/health")
//       .then((res) => res.json())
//       .then((data) => setStatus(data.status))
//       .catch(() => setStatus("backend unreachable"));
//   }, []);

//   return (
//     <main className="flex min-h-screen items-center justify-center">
//       <h1 className="text-3xl font-bold">Backend status: {status}</h1>
//     </main>
//   );
// }

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}