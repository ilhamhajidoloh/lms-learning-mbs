import Swal from "sweetalert2";

// Create custom Toast mixin
const ToastMixin = typeof window !== "undefined"
  ? Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener("mouseenter", Swal.stopTimer);
        toast.addEventListener("mouseleave", Swal.resumeTimer);
      },
    })
  : null;

export const toast = {
  success: (message: string) => {
    if (!ToastMixin) return;
    ToastMixin.fire({
      icon: "success",
      title: message,
    });
  },
  error: (message: string) => {
    if (!ToastMixin) return;
    ToastMixin.fire({
      icon: "error",
      title: message,
    });
  },
  loading: (message: string) => {
    if (typeof window === "undefined") return { close: () => {} };

    Swal.fire({
      title: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      preConfirm: () => false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    return {
      close: () => {
        Swal.close();
      },
    };
  },
};

export const alert = {
  success: (title: string, text?: string) => {
    if (typeof window === "undefined") return Promise.resolve();
    return Swal.fire({
      icon: "success",
      title,
      text,
      confirmButtonText: "ตกลง",
    });
  },
  error: (title: string, text?: string) => {
    if (typeof window === "undefined") return Promise.resolve();
    return Swal.fire({
      icon: "error",
      title,
      text,
      confirmButtonText: "ตกลง",
    });
  },
  warning: (title: string, text?: string) => {
    if (typeof window === "undefined") return Promise.resolve();
    return Swal.fire({
      icon: "warning",
      title,
      text,
      confirmButtonText: "ตกลง",
    });
  },
  confirm: async (title: string, text?: string, confirmButtonText = "ยืนยัน") => {
    if (typeof window === "undefined") return false;
    const result = await Swal.fire({
      icon: "question",
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    });
    return result.isConfirmed;
  },
};
