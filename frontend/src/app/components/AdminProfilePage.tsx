import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

import { Separator } from "./ui/separator";

import AuthService from "../../services/authService";

interface CurrentUser {
  user_id: number;
  full_name: string;
  email: string;
  age: number | null;
  occupation: string | null;
  it_background: boolean | null;
  role: string;
}

interface ProfilePageProps {
  user: CurrentUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
  onBack: () => void;
}

export function AdminProfilePage({
  user,
  setCurrentUser,
  onBack,
}: ProfilePageProps) {
  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");

  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    setProfileData({
      fullName: user.full_name ?? "",
      email: user.email ?? "",
    });
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setIsUpdating(true);

    try {
      const response = await AuthService.updateProfile({
        full_name: profileData.fullName,
      });

      if (!response.ok) {
        setErrorMessage(response.data.message);
        return;
      }

      setCurrentUser(response.data.data);

      setSuccessMessage(response.data.message);
    } catch (error) {
      console.error(error);

      setErrorMessage("Unable to update your profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const showPasswordSuccess = (message: string) => {
    setPasswordSuccessMessage(message);

    setTimeout(() => {
      setPasswordSuccessMessage("");
    }, 3000);
  };

  const showPasswordError = (message: string) => {
    setPasswordErrorMessage(message);

    setTimeout(() => {
      setPasswordErrorMessage("");
    }, 3000);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous messages
    setPasswordSuccessMessage("");
    setPasswordErrorMessage("");

    // Validate required fields BEFORE enabling loading
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      showPasswordError("Please complete all password fields.");
      return;
    }

    // Prevent using the same password
    if (passwordData.currentPassword === passwordData.newPassword) {
      showPasswordError(
        "Your new password must be different from your current password.",
      );
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await AuthService.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
        confirm_password: passwordData.confirmPassword,
      });

      if (!response.ok) {
        showPasswordError(response.data.message);
        return;
      }

      showPasswordSuccess(response.data.message);

      // Clear the password fields after a successful update
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error(error);

      showPasswordError("Unable to change password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Profile Management</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={profileData.fullName}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        fullName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>

                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    disabled
                  />
                </div>

                {successMessage && (
                  <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
                    <p className="text-sm text-green-400">{successMessage}</p>
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isUpdating}>
                  {isUpdating ? "Updating Profile..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmNewPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>

                {passwordSuccessMessage && (
                  <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
                    <p className="text-sm text-green-400">
                      {passwordSuccessMessage}
                    </p>
                  </div>
                )}

                {passwordErrorMessage && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">
                      {passwordErrorMessage}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword
                    ? "Updating Password..."
                    : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
