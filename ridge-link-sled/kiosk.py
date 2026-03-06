import tkinter as tk
from tkinter import ttk
import json
import os
import time
import cv2
from PIL import Image, ImageTk, ImageFilter
import threading

class RidgeKiosk:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Ridge-Link Cinematic Kiosk")
        self.root.attributes('-fullscreen', True)
        self.root.configure(bg='black')
        
        self.brand_color = '#ff5100'
        
        # State
        self.car_pool = []
        self.selected_car = ""
        self.ready = False
        self.status = "idle"
        self.branding = {"logo_url": "", "video_url": ""}
        
        # UI Elements
        self.setup_ui()
        
        # Video Engine
        self.cap = None
        self.current_frame = None
        self.is_blurred = False
        
        # Start loops
        self.update_data()
        self.start_video_loop()
        
        self.root.mainloop()

    def setup_ui(self):
        # Video Background
        self.canvas = tk.Canvas(self.root, highlightthickness=0, bg='black')
        self.canvas.pack(fill='both', expand=True)
        
        # Overlay Container ( Setup UI )
        self.overlay = tk.Frame(self.canvas, bg='#000', bd=0)
        self.overlay.place(relx=0.5, rely=0.5, anchor='center')
        self.overlay.pack_forget() # Hide by default
        
        # Logo (Bottom Right)
        self.logo_label = tk.Label(self.root, bg='black', bd=0)
        self.logo_label.place(relx=0.95, rely=0.95, anchor='se')

    def show_setup_ui(self):
        # Clear old widgets
        for widget in self.overlay.winfo_children():
            widget.destroy()
            
        inner = tk.Frame(self.overlay, bg='#111', padx=40, pady=40, highlightbackground=self.brand_color, highlightthickness=2)
        inner.pack()
        
        tk.Label(inner, text="PREPARE FOR MISSION", font=("Impact", 48, "italic"), fg='white', bg='#111').pack(pady=(0, 20))
        
        # Car Selection
        list_frame = tk.Frame(inner, bg='#111')
        list_frame.pack(fill='x', pady=20)
        
        for car in self.car_pool:
            clean_name = car.replace("ks_", "").replace("_", " ").upper()
            color = self.brand_color if self.selected_car == car else "#333"
            btn = tk.Button(list_frame, text=clean_name, font=("Arial", 14, "bold"),
                           bg=color, fg='white', bd=0, padx=20, pady=10,
                           command=lambda c=car: self.select_car(c))
            btn.pack(side='left', padx=5)

        # Ready Button
        btn_text = "READY TO RACE" if not self.ready else "WAITING FOR ADMIN..."
        btn_color = "green" if self.ready else self.brand_color
        tk.Button(inner, text=btn_text, font=("Arial", 20, "bold"), 
                  bg=btn_color, fg='white', bd=0, padx=40, pady=15,
                  command=self.toggle_ready).pack(pady=20)

    def select_car(self, car):
        self.selected_car = car
        self.save_state()
        self.show_setup_ui()

    def toggle_ready(self):
        self.ready = not self.ready
        self.save_state()
        self.show_setup_ui()

    def save_state(self):
        with open("selected_car.json", "w") as f:
            json.dump({
                "selected_car": self.selected_car,
                "ready": self.ready
            }, f)

    def update_data(self):
        try:
            if os.path.exists("kiosk_data.json"):
                with open("kiosk_data.json", "r") as f:
                    data = json.load(f)
                    self.car_pool = data.get("car_pool", [])
                    self.branding = data.get("branding", {})
                    new_status = data.get("status", "idle")
                    
                    if new_status != self.status:
                        self.status = new_status
                        if self.status == "setup":
                            self.is_blurred = True
                            self.overlay.place(relx=0.5, rely=0.5, anchor='center')
                            self.show_setup_ui()
                        else:
                            self.is_blurred = False
                            self.overlay.place_forget()
                            self.ready = False
                            
                    # Update logo
                    # (In real implementation, we'd fetch and cache the logo image)
        except:
            pass
        self.root.after(2000, self.update_data)

    def start_video_loop(self):
        video_path = os.path.join(os.path.dirname(__file__), "assets", "idle_race.mp4")
        if os.path.exists(video_path):
            self.cap = cv2.VideoCapture(video_path)
        
        def run():
            while True:
                if self.cap and self.cap.isOpened():
                    ret, frame = self.cap.read()
                    if not ret:
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        continue
                        
                    # Resize to screen
                    screen_w = self.root.winfo_screenwidth()
                    screen_h = self.root.winfo_screenheight()
                    frame = cv2.resize(frame, (screen_w, screen_h))
                    
                    # Convert to RGB
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(frame)
                    
                    if self.is_blurred:
                        img = img.filter(ImageFilter.GaussianBlur(radius=15))
                    
                    photo = ImageTk.PhotoImage(image=img)
                    self.canvas.create_image(0, 0, image=photo, anchor='nw')
                    self.canvas.img = photo # Keep reference
                    
                time.sleep(0.03) # ~30 FPS

        threading.Thread(target=run, daemon=True).start()

if __name__ == "__main__":
    RidgeKiosk()
