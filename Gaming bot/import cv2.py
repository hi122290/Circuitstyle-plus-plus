import cv2
import numpy as np
import mss
import torch
import pydirectinput
from ultralytics import YOLO
import time
import keyboard

# Disable PyDirectInput fail-safe to prevent corner-triggered exits
pydirectinput.FAILSAFE = False

# --- CONFIGURATION ---
class Config:
    MODEL_PATH = 'yolov8n.pt'  # Path to your AI weights
    CONFIDENCE_THRESHOLD = 0.55  # INCREASED for fewer false positives
    SCREEN_ROI = 640            # Size of the capture window (center of screen)
    SMOOTHING = 0.15            # Much lower for pixel-perfect precision
    AIM_OFFSET = 0.1            # Offset for headshots (10% down from top of box)
    TEAM_COLOR_LOW = np.array([35, 50, 50])   # HSV for Friendly (e.g., Green)
    TEAM_COLOR_HIGH = np.array([85, 255, 255])
    TOGGLE_KEY = 'n'            # Press 'n' to toggle AI on/off
    AUTO_FIRE = True            # Enable auto-firing when aiming
    AUTO_MOVE = True            # Enable auto-movement towards targets
    AUTO_LOOK = True            # Enable auto-camera control with arrow keys
    MOVE_FORWARD_KEY = 'w'      # Move forward
    MOVE_LEFT_KEY = 'a'         # Move left
    MOVE_BACK_KEY = 's'         # Move backward
    MOVE_RIGHT_KEY = 'd'        # Move right
    LOOK_UP_KEY = 'up'          # Look up
    LOOK_DOWN_KEY = 'down'      # Look down
    LOOK_LEFT_KEY = 'left'      # Look left
    LOOK_RIGHT_KEY = 'right'    # Look right
    FIRE_RATE = 0.08            # Seconds between shots (slower but more accurate)
    ROAM_SPEED = 0.05           # Speed of roaming behavior
    AIM_LOCK_FRAMES = 5         # Frames target must be centered before firing
    MAX_AIM_OFFSET = 30          # Max pixels off-center before stopping fire
    AGGRESSIVE_AIM_LOCK_FRAMES = 2  # Reduced aim lock when taking damage
    AGGRESSIVE_FIRE_RATE = 0.05  # Faster fire rate when health is low
    DAMAGE_THRESHOLD = 0.7       # Health % below which aggressive mode activates

class AICombatBot:
    def __init__(self):
        print("[Initializing] Loading AI model...")
        self.model = YOLO(Config.MODEL_PATH)
        
        # Performance optimization: use GPU if available
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model.to(self.device)
        
        self.sct = mss.mss()
        self.screen_w, self.screen_h = pydirectinput.size()
        
        # Define capture region (Center of screen)
        self.monitor = {
            "top": (self.screen_h // 2) - (Config.SCREEN_ROI // 2),
            "left": (self.screen_w // 2) - (Config.SCREEN_ROI // 2),
            "width": Config.SCREEN_ROI,
            "height": Config.SCREEN_ROI,
        }
        
        self.ai_enabled = False
        self.last_toggle_time = 0
        self.roam_direction = 0  # 0=forward, 1=left, 2=right, 3=back
        self.roam_timer = 0
        self.look_direction = 0  # 0=center, 1=up, 2=down, 3=left, 4=right
        self.aim_lock_counter = 0  # Frames aim has been locked
        self.last_target_id = None  # Track if target changed
        self.last_health_value = 100  # Track previous health
        self.is_taking_damage = False  # Aggressive mode flag
        self.damage_time = 0  # Time damage was last detected
        
        print(f"[Ready] Running on {self.device}")
        print(f"[Controls] Press 'N' to toggle AI on/off. Press 'Q' to quit.")
        print(f"[Features] Auto-aim with arrow keys, roaming, precision fire, damage detection.")

    def is_friendly(self, frame, box):
        """
        Team Detection Logic:
        Checks the area above the detected player for 'friendly' color signatures.
        """
        x1, y1, x2, y2 = map(int, box)
        # Check a 20px area above the detection for team UI tags
        tag_roi = frame[max(0, y1-25):y1, x1:x2]
        
        if tag_roi.size == 0:
            return False

        hsv = cv2.cvtColor(tag_roi, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, Config.TEAM_COLOR_LOW, Config.TEAM_COLOR_HIGH)
        
        # If more than 5% of the tag area matches friendly color, skip
        return np.sum(mask) > (tag_roi.size * 0.05)

    def move_mouse(self, target_x, target_y):
        """Calculates relative movement and moves the cursor with precision."""
        # Calculate distance from center of the ROI
        center = Config.SCREEN_ROI // 2
        dx = target_x - center
        dy = target_y - center
        
        # Use lower smoothing for better precision
        rel_x = int(dx * (1 - Config.SMOOTHING))
        rel_y = int(dy * (1 - Config.SMOOTHING))
        
        # Only move if distance is significant (reduces jitter)
        if abs(rel_x) > 1 or abs(rel_y) > 1:
            try:
                pydirectinput.moveRel(rel_x, rel_y, relative=True)
            except:
                # Catch any movement errors silently
                pass
    
    def detect_cover(self, frame, target_box):
        """Detects if there's a wall/cover between player and target."""
        x1, y1, x2, y2 = map(int, target_box)
        target_center_x = (x1 + x2) // 2
        target_center_y = (y1 + y2) // 2
        frame_center_x = frame.shape[1] // 2
        frame_center_y = frame.shape[0] // 2
        
        # Sample pixels between player center and target to detect walls
        steps = 10
        wall_pixels = 0
        
        for i in range(1, steps):
            sample_x = int(frame_center_x + (target_center_x - frame_center_x) * (i / steps))
            sample_y = int(frame_center_y + (target_center_y - frame_center_y) * (i / steps))
            
            if 0 <= sample_x < frame.shape[1] and 0 <= sample_y < frame.shape[0]:
                pixel = frame[sample_y, sample_x]
                # Check if pixel is very dark (likely a wall) - values close to 0
                if np.mean(pixel) < 30:
                    wall_pixels += 1
        
        # If more than 30% of path is dark, there's likely a wall
        return wall_pixels > (steps * 0.3)
    
    def is_aim_locked(self, target_center_x, target_center_y, frames_locked):
        """Check if aim is locked on target (target is centered enough)."""
        roi_center = Config.SCREEN_ROI // 2
        dx = abs(target_center_x - roi_center)
        dy = abs(target_center_y - roi_center)
        
        # Target must be within MAX_AIM_OFFSET pixels of center
        return dx < Config.MAX_AIM_OFFSET and dy < Config.MAX_AIM_OFFSET and frames_locked >= Config.AIM_LOCK_FRAMES
    
    def detect_damage(self, frame):
        """Detects if player is taking damage by monitoring health bar area."""
        # Sample health bar area (typically top-left, red region in games)
        h, w = frame.shape[:2]
        health_roi = frame[0:50, 0:150]  # Top-left corner where health is usually displayed
        
        if health_roi.size == 0:
            return False, self.last_health_value
        
        # Convert to HSV and look for red/damage colors
        hsv = cv2.cvtColor(health_roi, cv2.COLOR_BGR2HSV)
        
        # Red colors in HSV (damage indicator)
        red_low1 = np.array([0, 100, 100])
        red_high1 = np.array([10, 255, 255])
        red_low2 = np.array([170, 100, 100])
        red_high2 = np.array([180, 255, 255])
        
        mask1 = cv2.inRange(hsv, red_low1, red_high1)
        mask2 = cv2.inRange(hsv, red_low2, red_high2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Calculate current health estimate (red pixels = damage)
        red_pixels = np.sum(mask) / mask.size
        health_percentage = max(0, 100 - (red_pixels * 500))  # Normalize to 0-100
        
        # Detect if taking damage (health dropped)
        taking_damage = health_percentage < self.last_health_value - 5
        self.last_health_value = health_percentage
        
        return taking_damage, health_percentage
    
    def roam_around(self, frame_counter):
        """Roaming behavior when no enemies found."""
        # Change direction every 2 seconds (~60 frames at 30fps)
        if frame_counter % 60 == 0:
            self.roam_direction = np.random.randint(0, 4)
            self.look_direction = np.random.randint(0, 5)
        
        # Move based on roaming direction
        if self.roam_direction == 0:  # Forward
            keyboard.press(Config.MOVE_FORWARD_KEY)
            keyboard.release(Config.MOVE_BACK_KEY)
        elif self.roam_direction == 1:  # Left
            keyboard.press(Config.MOVE_LEFT_KEY)
            keyboard.release(Config.MOVE_RIGHT_KEY)
        elif self.roam_direction == 2:  # Right
            keyboard.press(Config.MOVE_RIGHT_KEY)
            keyboard.release(Config.MOVE_LEFT_KEY)
        elif self.roam_direction == 3:  # Back
            keyboard.press(Config.MOVE_BACK_KEY)
            keyboard.release(Config.MOVE_FORWARD_KEY)
        
        # Look around while roaming
        if self.look_direction == 1:  # Up
            pydirectinput.moveRel(0, -15, relative=True)
        elif self.look_direction == 2:  # Down
            pydirectinput.moveRel(0, 15, relative=True)
        elif self.look_direction == 3:  # Left
            pydirectinput.moveRel(-20, 0, relative=True)
        elif self.look_direction == 4:  # Right
            pydirectinput.moveRel(20, 0, relative=True)

    def run(self):
        try:
            fps_counter = 0
            last_shot_time = 0
            aim_active = False
            
            print("\n[STATUS] AI Standby - Press 'N' to activate\n")
            
            while True:
                fps_counter += 1
                current_time = time.time()
                
                # Check for toggle key
                if keyboard.is_pressed(Config.TOGGLE_KEY):
                    if current_time - self.last_toggle_time > 0.3:  # Debounce
                        self.ai_enabled = not self.ai_enabled
                        self.last_toggle_time = current_time
                        status = "ACTIVE" if self.ai_enabled else "STANDBY"
                        print(f"\n[STATUS] AI {status}\n")
                
                # Quit with 'q'
                if keyboard.is_pressed('q'):
                    print("[SHUTDOWN] Bot deactivated by user")
                    break
                
                if not self.ai_enabled:
                    # Release all keys when disabled
                    keyboard.release(Config.MOVE_FORWARD_KEY)
                    keyboard.release(Config.MOVE_LEFT_KEY)
                    keyboard.release(Config.MOVE_BACK_KEY)
                    keyboard.release(Config.MOVE_RIGHT_KEY)
                    pydirectinput.keyUp('right')  # Release right click
                    self.aim_lock_counter = 0
                    time.sleep(0.01)
                    continue
                
                # 1. Capture Screen
                screenshot = self.sct.grab(self.monitor)
                frame = np.array(screenshot)[:, :, :3]
                frame = np.ascontiguousarray(frame)
                
                # 1.5 Detect if taking damage
                taking_damage, current_health = self.detect_damage(frame)
                if taking_damage:
                    self.is_taking_damage = True
                    self.damage_time = current_time
                    if fps_counter % 10 == 0:
                        print(f"[DAMAGE] Health: {current_health:.0f}% - AGGRESSIVE MODE ACTIVATED")
                
                # Disable aggressive mode after 3 seconds of no damage
                if self.is_taking_damage and (current_time - self.damage_time) > 3.0:
                    self.is_taking_damage = False

                # 2. AI Inference
                results = self.model.predict(
                    frame, 
                    conf=Config.CONFIDENCE_THRESHOLD, 
                    device=self.device, 
                    verbose=False,
                    imgsz=Config.SCREEN_ROI
                )

                # 3. Process Detections
                targets = []
                for r in results:
                    for box in r.boxes:
                        if box.cls == 0:
                            coords = box.xyxy[0].tolist()
                            if not self.is_friendly(frame, coords):
                                targets.append(coords)

                # 4. Combat or Roaming
                roi_center = Config.SCREEN_ROI // 2
                
                if targets:
                    # COMBAT MODE - Target found
                    best_target = min(targets, key=lambda b: (((b[0]+b[2])/2) - roi_center)**2)
                    
                    # Check for wall/cover between player and target
                    target_blocked = self.detect_cover(frame, best_target)
                    
                    # Calculate Aim Point with precision
                    t_x = (best_target[0] + best_target[2]) / 2
                    t_y = best_target[1] + (best_target[3] - best_target[1]) * Config.AIM_OFFSET
                    
                    # Determine required aim-lock frames based on combat state
                    required_frames = Config.AGGRESSIVE_AIM_LOCK_FRAMES if self.is_taking_damage else Config.AIM_LOCK_FRAMES
                    fire_rate = Config.AGGRESSIVE_FIRE_RATE if self.is_taking_damage else Config.FIRE_RATE
                    
                    # Check if aim is locked (with dynamic requirements)
                    roi_center_val = Config.SCREEN_ROI // 2
                    dx = abs(t_x - roi_center_val)
                    dy = abs(t_y - roi_center_val)
                    aim_locked = (dx < Config.MAX_AIM_OFFSET and dy < Config.MAX_AIM_OFFSET and 
                                 self.aim_lock_counter >= required_frames)
                    
                    # Track if same target
                    target_id = hash(tuple(best_target))
                    if target_id != self.last_target_id:
                        self.aim_lock_counter = 0
                        self.last_target_id = target_id
                    else:
                        self.aim_lock_counter += 1
                    
                    # Aim (right click) - only if not blocked
                    if not target_blocked:
                        pydirectinput.keyDown('right')
                        self.move_mouse(t_x, t_y)
                        
                        # Fire (left click) ONLY when aim is locked and target not blocked
                        if Config.AUTO_FIRE and aim_locked and (current_time - last_shot_time) > fire_rate:
                            pydirectinput.click(button='left')
                            last_shot_time = current_time
                            aim_active = True
                            mode = "[AGGRESSIVE]" if self.is_taking_damage else "[PRECISION]"
                            if fps_counter % 6 == 0:
                                print(f"{mode} FIRE! Lock: {self.aim_lock_counter} frames")
                        elif fps_counter % 15 == 0:
                            if aim_locked:
                                status = "AGGRESSIVE" if self.is_taking_damage else "READY"
                                print(f"[{status}] Locked on target ({len(targets)} in view)")
                            else:
                                print(f"[ALIGNING] Offset: {int(abs(t_x-roi_center_val))} px (need {required_frames} frames)")
                    else:
                        # Target blocked by wall
                        pydirectinput.keyUp('right')
                        self.aim_lock_counter = 0
                        if fps_counter % 20 == 0:
                            print(f"[BLOCKED] Target behind cover, repositioning...")
                    
                    # Movement towards target
                    if Config.AUTO_MOVE and not target_blocked:
                        target_x_center = (best_target[0] + best_target[2]) / 2
                        target_y_center = (best_target[1] + best_target[3]) / 2
                        
                        # Move towards target if off-center
                        if target_x_center < roi_center - 80:
                            keyboard.press(Config.MOVE_LEFT_KEY)
                        else:
                            keyboard.release(Config.MOVE_LEFT_KEY)
                            
                        if target_x_center > roi_center + 80:
                            keyboard.press(Config.MOVE_RIGHT_KEY)
                        else:
                            keyboard.release(Config.MOVE_RIGHT_KEY)
                        
                        if target_y_center < roi_center - 80:
                            keyboard.press(Config.MOVE_FORWARD_KEY)
                        else:
                            keyboard.release(Config.MOVE_FORWARD_KEY)
                            
                        if target_y_center > roi_center + 80:
                            keyboard.press(Config.MOVE_BACK_KEY)
                        else:
                            keyboard.release(Config.MOVE_BACK_KEY)
                else:
                    # ROAMING MODE - No targets found
                    pydirectinput.keyUp('right')
                    aim_active = False
                    self.aim_lock_counter = 0
                    
                    # Roam around to find enemies
                    self.roam_around(fps_counter)
                    
                    if fps_counter % 50 == 0:
                        print(f"[ROAMING] Scanning for enemies...")

        except KeyboardInterrupt:
            print("\n[STOPPED] Bot deactivated.")

if __name__ == "__main__":
    bot = AICombatBot()
    bot.run()
