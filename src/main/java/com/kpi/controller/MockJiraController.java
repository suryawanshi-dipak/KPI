package com.kpi.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class MockJiraController {

    @GetMapping("/api/v1/mock-jira/issue/{issueKey}")
    public ResponseEntity<Map<String, Object>> getIssue(
            @PathVariable String issueKey,
            @RequestParam(required = false) String status) {

        String finalStatus = "In Progress"; // default
        if (status != null) {
            finalStatus = status;
        } else if (issueKey.endsWith("1") || issueKey.endsWith("fixed") || issueKey.endsWith("resolved") || issueKey.contains("20456")) {
            finalStatus = "Done";
        } else if (issueKey.endsWith("2") || issueKey.endsWith("unfixed")) {
            finalStatus = "Won't Fix";
        } else if (issueKey.endsWith("3") || issueKey.endsWith("active")) {
            finalStatus = "In Progress";
        }

        Map<String, Object> response = new HashMap<>();
        response.put("key", issueKey);

        Map<String, Object> fields = new HashMap<>();
        Map<String, Object> statusMap = new HashMap<>();
        statusMap.put("name", finalStatus);
        fields.put("status", statusMap);
        response.put("fields", fields);

        return ResponseEntity.ok(response);
    }
}
