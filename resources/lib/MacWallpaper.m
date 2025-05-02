#import <Cocoa/Cocoa.h>

// 导出函数，用于设置窗口层级为桌面级别
void setWindowLevelToDesktop(long long windowHandle) {
    NSView *view = (NSView *)windowHandle;
    if (!view) {
        NSLog(@"Invalid window handle");
        return;
    }
    
    NSWindow *window = [view window];
    if (!window) {
        NSLog(@"Cannot get window from view");
        return;
    }
    
    // 设置窗口层级为桌面背景层级
    [window setLevel:kCGDesktopWindowLevel];
    [window setCollectionBehavior:NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary];
    
    // 确保窗口在所有空间都可见
    [window setCollectionBehavior:NSWindowCollectionBehaviorCanJoinAllSpaces];
    
    // 设置窗口为非激活状态，避免获取焦点
    [window setIgnoresMouseEvents:YES];
    
    NSLog(@"Window level set to desktop level successfully");
}