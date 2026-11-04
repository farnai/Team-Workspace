"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Users,
  UserPlus,
  Shield,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AdminUsersManagementProps {
  currentAdminId: string;
}

export function AdminUsersManagement({ currentAdminId }: AdminUsersManagementProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<ManagedUser | null>(null);

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset Password Form State
  const [newPassword, setNewPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "მომხმარებლების ჩატვირთვა ვერ მოხერხდა");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "სერვერის შეცდომა");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "მომხმარებლების ჩატვირთვა ვერ მოხერხდა");
        }
        const data = await res.json();
        if (active) {
          setUsers(data.users || []);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "სერვერის შეცდომა");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleStatus = async (user: ManagedUser) => {
    if (user.id === currentAdminId && user.isActive) {
      alert("საკუთარი ადმინისტრატორის ანგარიშის დეაქტივაცია შეუძლებელია");
      return;
    }

    const actionText = user.isActive ? "დეაქტივაცია" : "გააქტიურება";
    if (!confirm(`ნამდვილად გსურთ მომხმარებლის (${user.name}) ${actionText}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "სტატუსის შეცვლა ვერ მოხერხდა");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
      );
      setSuccessMessage(`მომხმარებლის (${user.name}) სტატუსი წარმატებით განახლდა`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა სტატუსის შეცვლისას");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      setFormError("გთხოვთ შეავსოთ ყველა სავალდებულო ველი");
      return;
    }

    try {
      setIsSubmittingNewUser(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "მომხმარებლის შექმნა ვერ მოხერხდა");
      }

      setIsAddUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("USER");
      setSuccessMessage(`მომხმარებელი (${data.user.name}) წარმატებით შეიქმნა`);
      setTimeout(() => setSuccessMessage(null), 4000);
      refreshUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "შეცდომა შექმნისას");
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    setResetError(null);

    if (!newPassword || newPassword.length < 6) {
      setResetError("პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო");
      return;
    }

    try {
      setIsSubmittingPassword(true);
      const res = await fetch(`/api/admin/users/${selectedUserForReset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "პაროლის შეცვლა ვერ მოხერხდა");
      }

      setIsResetPasswordOpen(false);
      setSelectedUserForReset(null);
      setNewPassword("");
      setSuccessMessage("პაროლი წარმატებით შეიცვალა");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "შეცდომა პაროლის შეცვლისას");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleChangeRole = async (user: ManagedUser, newRole: "ADMIN" | "USER") => {
    if (user.role === newRole) return;
    if (user.id === currentAdminId && newRole === "USER") {
      alert("საკუთარი ადმინისტრატორის როლის შეცვლა შეუძლებელია");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "როლის შეცვლა ვერ მოხერხდა");
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );
      setSuccessMessage(`როლი წარმატებით შეიცვალა: ${newRole}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა როლის შეცვლისას");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/50 p-6 lg:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Users size={16} />
            <span>ადმინ პანელი</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">
            მომხმარებლების მართვა
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            გუნდის წევრების დამატება, აქტივაცია/დეაქტივაცია და პაროლის მართვა.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsAddUserOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <UserPlus size={16} />
          <span>ახალი მომხმარებელი</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-stone-400 gap-3">
            <Loader2 size={28} className="animate-spin text-orange-600" />
            <span className="text-xs">მომხმარებლები იტვირთება...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            მომხმარებლები ვერ მოიძებნა
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/80 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">მომხმარებელი</th>
                  <th className="py-3 px-5">ელ.ფოსტა</th>
                  <th className="py-3 px-5">როლი</th>
                  <th className="py-3 px-5">სტატუსი</th>
                  <th className="py-3 px-5">რეგისტრაციის თარიღი</th>
                  <th className="py-3 px-5 text-right">მოქმედებები</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-stone-50/60 transition-colors ${
                      !user.isActive ? "opacity-60 bg-stone-50/30" : ""
                    }`}
                  >
                    {/* User info & avatar */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs ring-1 ring-stone-200">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.name}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            user.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-1.5">
                            <span>{user.name}</span>
                            {user.id === currentAdminId && (
                              <span className="text-[10px] text-stone-400 font-normal">
                                (თქვენ)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-5 text-stone-600 font-medium">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-5">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleChangeRole(user, e.target.value as "ADMIN" | "USER")
                        }
                        disabled={user.id === currentAdminId}
                        className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 font-semibold text-stone-700 cursor-pointer disabled:opacity-60"
                      >
                        <option value="USER">USER (თანამშრომელი)</option>
                        <option value="ADMIN">ADMIN (ადმინისტრატორი)</option>
                      </select>
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-5">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle size={12} className="text-emerald-600" />
                          <span>აქტიური</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                          <XCircle size={12} className="text-rose-600" />
                          <span>დეაქტივირებული</span>
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-5 text-stone-500">
                      {new Date(user.createdAt).toLocaleDateString("ka-GE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUserForReset(user);
                          setNewPassword("");
                          setResetError(null);
                          setIsResetPasswordOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium transition-colors cursor-pointer"
                        title="პაროლის შეცვლა"
                      >
                        <Key size={13} />
                        <span>პაროლი</span>
                      </button>

                      {user.id !== currentAdminId && (
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                            user.isActive
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/50"
                          }`}
                        >
                          {user.isActive ? "დეაქტივაცია" : "გააქტიურება"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  ახალი მომხმარებლის შექმნა
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  სახელი და გვარი *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="მაგ: გიორგი ბერიძე"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ელ.ფოსტა *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name@team.local"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  პაროლი * (მინ. 6 სიმბოლო)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  სისტემური როლი
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewUserRole("USER")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      newUserRole === "USER"
                        ? "border-orange-500 bg-orange-50/50 text-orange-900 font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <div className="font-bold">USER</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      თანამშრომელი
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole("ADMIN")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      newUserRole === "ADMIN"
                        ? "border-orange-500 bg-orange-50/50 text-orange-900 font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Shield size={12} />
                      ADMIN
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      ადმინისტრატორი
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingNewUser && <Loader2 size={13} className="animate-spin" />}
                  <span>შენახვა</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordOpen && selectedUserForReset && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Key size={16} />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  პაროლის შეცვლა
                </h3>
              </div>
              <button
                onClick={() => setIsResetPasswordOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div className="text-xs text-stone-600">
                ახალი პაროლი მომხმარებლისთვის:{" "}
                <span className="font-bold text-stone-900">
                  {selectedUserForReset.name}
                </span>{" "}
                ({selectedUserForReset.email})
              </div>

              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ახალი პაროლი * (მინ. 6 სიმბოლო)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingPassword && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  <span>განახლება</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
