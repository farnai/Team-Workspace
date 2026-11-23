"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  Code2,
  PenTool,
  Trash2,
  Edit3,
  UserX,
  UserCheck,
} from "lucide-react";
import { Department } from "@prisma/client";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  department?: Department;
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
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<ManagedUser | null>(null);

  // Edit User Form State
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState<"USER" | "ADMIN">("USER");
  const [editUserDepartment, setEditUserDepartment] = useState<Department>(Department.DEVELOPMENT);
  const [isSubmittingEditUser, setIsSubmittingEditUser] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");
  const [newUserDepartment, setNewUserDepartment] = useState<Department>(Department.DEVELOPMENT);
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    const confirmMessage = user.isActive
      ? `ნამდვილად გსურთ მომხმარებლის (${user.name}) დეაქტივაცია?\n\nმიმდინარე აქტიური დავალებებიდან მომხმარებელი ამოიშლება და დედლაინები განულდება, ხოლო არქივში შესრულებული სამუშაოების ისტორია შენარჩუნდება.`
      : `ნამდვილად გსურთ მომხმარებლის (${user.name}) გააქტიურება?`;

    if (!confirm(confirmMessage)) {
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

  const handleDeleteUser = async (user: ManagedUser) => {
    if (user.id === currentAdminId) {
      alert("საკუთარი ადმინისტრატორის ანგარიშის წაშლა შეუძლებელია");
      return;
    }

    if (
      !confirm(
        `ნამდვილად გსურთ მომხმარებლის (${user.name}) წაშლა?\n\nყურადღება: მომხმარებელი სრულად წაიშლება სიიდან, მიმდინარე აქტიური დავალებებიდან ამოიშლება და დედლაინები განულდება. არქივში შესრულებული სამუშაოების ისტორია და სახელი შენარჩუნდება.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "მომხმარებლის წაშლა ვერ მოხერხდა");
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSuccessMessage(data.message || `მომხმარებელი (${user.name}) წარმატებით წაიშალა`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა მომხმარებლის წაშლისას");
    }
  };

  const handleChangeDepartment = async (user: ManagedUser, newDepartment: Department) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: newDepartment }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "გუნდის შეცვლა ვერ მოხერხდა");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, department: newDepartment } : u))
      );
      setSuccessMessage(`მომხმარებლის (${user.name}) გუნდი წარმატებით განახლდა`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა გუნდის შეცვლისას");
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
          department: newUserDepartment,
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
      setNewUserDepartment(Department.DEVELOPMENT);
      setSuccessMessage(`მომხმარებელი (${data.user.name}) წარმატებით შეიქმნა`);
      setTimeout(() => setSuccessMessage(null), 4000);
      refreshUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "შეცდომა შექმნისას");
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const openEditUserModal = (user: ManagedUser) => {
    setSelectedUserForEdit(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserPassword("");
    setEditUserRole(user.role);
    setEditUserDepartment(user.department || Department.DEVELOPMENT);
    setEditFormError(null);
    setIsEditUserOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setEditFormError(null);

    if (!editUserName.trim() || editUserName.trim().length < 2) {
      setEditFormError("სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან");
      return;
    }
    if (!editUserEmail.trim()) {
      setEditFormError("ელ.ფოსტა სავალდებულოა");
      return;
    }
    if (editUserPassword && editUserPassword.length < 6) {
      setEditFormError("პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო");
      return;
    }

    try {
      setIsSubmittingEditUser(true);
      const payload: Record<string, unknown> = {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        department: editUserDepartment,
      };
      if (selectedUserForEdit.id !== currentAdminId) {
        payload.role = editUserRole;
      }
      if (editUserPassword) {
        payload.password = editUserPassword;
      }

      const res = await fetch(`/api/admin/users/${selectedUserForEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "მომხმარებლის განახლება ვერ მოხერხდა");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForEdit.id
            ? {
                ...u,
                name: data.user.name,
                email: data.user.email,
                role: data.user.role,
                department: data.user.department,
              }
            : u
        )
      );
      setIsEditUserOpen(false);
      setSelectedUserForEdit(null);
      setSuccessMessage(`მომხმარებლის (${data.user.name}) მონაცემები წარმატებით განახლდა`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setEditFormError(err instanceof Error ? err.message : "შეცდომა განახლებისას");
    } finally {
      setIsSubmittingEditUser(false);
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
                  <th className="py-3 px-3">მომხმარებელი</th>
                  <th className="py-3 px-3">ელ.ფოსტა</th>
                  <th className="py-3 px-3">გუნდი</th>
                  <th className="py-3 px-3">როლი</th>
                  <th className="py-3 px-3">სტატუსი</th>
                  <th className="py-3 px-3 whitespace-nowrap">რეგისტრაცია</th>
                  <th className="py-3 px-3 text-right">მოქმედებები</th>
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
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs ring-1 ring-stone-200 shrink-0">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.name}
                              width={28}
                              height={28}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            user.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 flex items-center gap-1 truncate">
                            <span className="truncate">{user.name}</span>
                            {user.id === currentAdminId && (
                              <span className="text-[10px] text-stone-400 font-normal shrink-0">
                                (თქვენ)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-3 text-stone-600 font-medium truncate max-w-[190px]" title={user.email}>
                      {user.email}
                    </td>

                    {/* Department (Icon Selector) */}
                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1 bg-stone-100/80 p-0.5 rounded-lg border border-stone-200/80">
                        <button
                          type="button"
                          onClick={() => handleChangeDepartment(user, Department.DEVELOPMENT)}
                          title="დეველოპმენტი"
                          className={`p-1.5 rounded-md transition-all cursor-pointer ${
                            (user.department || Department.DEVELOPMENT) === Department.DEVELOPMENT
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "text-stone-400 hover:text-blue-600 hover:bg-white"
                          }`}
                        >
                          <Code2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeDepartment(user, Department.CONTENT)}
                          title="კონტენტი"
                          className={`p-1.5 rounded-md transition-all cursor-pointer ${
                            user.department === Department.CONTENT
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "text-stone-400 hover:text-purple-600 hover:bg-white"
                          }`}
                        >
                          <PenTool size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleChangeRole(user, e.target.value as "ADMIN" | "USER")
                        }
                        disabled={user.id === currentAdminId}
                        className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 font-semibold text-stone-700 cursor-pointer disabled:opacity-60"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle size={11} className="text-emerald-600" />
                          <span>აქტიური</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                          <XCircle size={11} className="text-rose-600" />
                          <span>დეაქტივირებული</span>
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-3 text-stone-500 whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString("ka-GE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditUserModal(user)}
                          className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/60 rounded-lg transition-colors cursor-pointer"
                          title="რედაქტირება"
                        >
                          <Edit3 size={14} />
                        </button>

                        {user.id !== currentAdminId && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                user.isActive
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/50"
                              }`}
                              title={
                                user.isActive
                                  ? "მომხმარებლის დეაქტივაცია (აქტიური დავალებებიდან ამოშლა)"
                                  : "მომხმარებლის გააქტიურება"
                              }
                            >
                              {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200/50 rounded-lg transition-colors cursor-pointer"
                              title="მომხმარებლის წაშლა"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
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
                  გუნდი / მიმართულება *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserDepartment(Department.DEVELOPMENT)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newUserDepartment === Department.DEVELOPMENT
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <Code2 size={13} className={newUserDepartment === Department.DEVELOPMENT ? "text-white" : "text-blue-600"} />
                    <span>დეველოპმენტი</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUserDepartment(Department.CONTENT)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newUserDepartment === Department.CONTENT
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-purple-50/50"
                    }`}
                  >
                    <PenTool size={13} className={newUserDepartment === Department.CONTENT ? "text-white" : "text-purple-600"} />
                    <span>კონტენტი</span>
                  </button>
                </div>
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

      {/* Edit User Modal */}
      {isEditUserOpen && selectedUserForEdit && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Edit3 size={16} />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  მომხმარებლის რედაქტირება
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsEditUserOpen(false);
                  setSelectedUserForEdit(null);
                }}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {editFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  სახელი და გვარი *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
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
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ახალი პაროლი (არასავალდებულო, მინ. 6 სიმბოლო)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="დატოვეთ ცარიელი თუ არ ცვლით"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  გუნდი / მიმართულება *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditUserDepartment(Department.DEVELOPMENT)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editUserDepartment === Department.DEVELOPMENT
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <Code2 size={13} className={editUserDepartment === Department.DEVELOPMENT ? "text-white" : "text-blue-600"} />
                    <span>დეველოპმენტი</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditUserDepartment(Department.CONTENT)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editUserDepartment === Department.CONTENT
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-purple-50/50"
                    }`}
                  >
                    <PenTool size={13} className={editUserDepartment === Department.CONTENT ? "text-white" : "text-purple-600"} />
                    <span>კონტენტი</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  სისტემური როლი
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={selectedUserForEdit.id === currentAdminId}
                    onClick={() => setEditUserRole("USER")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      editUserRole === "USER"
                        ? "border-orange-500 bg-orange-50/50 text-orange-900 font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    USER
                  </button>
                  <button
                    type="button"
                    disabled={selectedUserForEdit.id === currentAdminId}
                    onClick={() => setEditUserRole("ADMIN")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      editUserRole === "ADMIN"
                        ? "border-orange-500 bg-orange-50/50 text-orange-900 font-bold"
                        : "border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    ADMIN
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditUserOpen(false);
                    setSelectedUserForEdit(null);
                  }}
                  className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditUser}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingEditUser && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  <span>შენახვა</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
