package com.yuzee.tokenlab.controller;

import com.yuzee.tokenlab.dto.BenchmarkRequest;
import com.yuzee.tokenlab.dto.BenchmarkResponse;
import com.yuzee.tokenlab.service.BenchmarkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/benchmark")
@CrossOrigin(origins = "*")
public class BenchmarkController {

    private final BenchmarkService benchmarkService;

    public BenchmarkController(BenchmarkService benchmarkService) {
        this.benchmarkService = benchmarkService;
    }

    @PostMapping
    public ResponseEntity<BenchmarkResponse> executeBenchmark(@RequestBody BenchmarkRequest request) {
        BenchmarkResponse response = benchmarkService.runBenchmark(request);
        return ResponseEntity.ok(response);
    }
}
